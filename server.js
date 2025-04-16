const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Initialize Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Route to get nearby places based on location and type
app.post("/api/nearby-places", async (req, res) => {
  const { location, type } = req.body;
  const placeType = type || "restaurant"; // Default to restaurant if no type is provided

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are a highly intelligent location-aware assistant.

Given the following user address of google map: "${location}", generate a detailed JSON array of top ${placeType.toUpperCase()} nearby (within 10 km). For each ${placeType}, include relevant information such as:

- name: (string) Name of the ${placeType}
- rating: (float) Current average rating (if available)
- review_summary: (string) A short summary of what most customers say (if available)
- distance: (float) Approximate distance in kilometers

${placeType === 'restaurant' ? `
- best_dishes: (array of strings) Highlighted best dishes (if applicable)
- cuisine: (string) Type of cuisine (if applicable)
- price_range: (string) General price category (e.g., $, $$, $$$) (if applicable)
` : ''}
${placeType === 'hotel' ? `
- amenities: (array of strings) Key amenities offered (e.g., "Free Wi-Fi", "Swimming Pool") (if applicable)
` : ''}
${placeType === 'gym' ? `
- facility_type: (string) Type of gym (e.g., "Full-service", "Specialty") (if applicable)
- opening_hours: (string) General opening hours (if available)
` : ''}
${placeType === 'cafe' ? `
- best_drinks: (array of strings) Highlighted best drinks (if applicable)
` : ''}
${placeType === 'park' ? `
- features: (array of strings) Key features (e.g., "Playground", "Walking trails") (if applicable)
` : ''}
${placeType === 'hospital' ? `
- specialties: (array of strings) Main specialties (e.g., "Cardiology", "Neurology") (if applicable)
- emergency_services: (boolean) Whether emergency services are available
` : ''}
Respond ONLY with a valid JSON array like this:

[
  {
    "name": "${placeType === 'restaurant' ? 'Example Restaurant' : (placeType === 'hotel' ? 'Example Hotel' : 'Example Place')}",
    "rating": 4.5,
    "review_summary": "A great ${placeType}.",
    "distance": 2.5,
    ${placeType === 'restaurant' ? `"best_dishes": ["Dish 1", "Dish 2"], "cuisine": "Example Cuisine", "price_range": "$$"` : ''}
    ${placeType === 'hotel' ? `"amenities": ["Free Wi-Fi", "Breakfast"], "price_range": "$$$"` : ''}
    ${placeType === 'gym' ? `"facility_type": "Full-service", "opening_hours": "Mon-Fri 6 AM - 10 PM"` : ''}
    ${placeType === 'cafe' ? `"best_drinks": ["Coffee", "Tea"], "price_range": "$"` : ''}
    ${placeType === 'park' ? `"features": ["Walking trails", "Picnic areas"]` : ''}
    ${placeType === 'hospital' ? `"specialties": ["General Medicine"], "emergency_services": true` : ''}
  },
  ...
]

Do NOT include any explanation or extra text — only return the JSON array.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();

    console.log(`Raw Gemini Response (${placeType}):\n`, responseText);

    // Sanitize code block wrappers (if any)
    responseText = responseText.replace(/^```json\n/, '').replace(/```$/, '');

    try {
      const places = JSON.parse(responseText);
      res.status(200).json({ places });
    } catch (parseError) {
      console.error(`Error parsing JSON (${placeType}):`, parseError);
      console.error(`Attempting to fix raw text (${placeType})...`);

      const fixedJson = responseText
        .replace(/,\s*\]/g, "]")
        .replace(/,\s*\}/g, "}")
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
        .replace(/'([^']+)'/g, '"$1"');

      try {
        const fixedPlaces = JSON.parse(fixedJson);
        res.status(200).json({ places: fixedPlaces });
      } catch (fixError) {
        console.error(`Final parsing failed (${placeType}):`, fixError);
        res.status(500).json({ error: `Gemini returned invalid JSON for ${placeType}.` });
      }
    }
  } catch (err) {
    console.error("API Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});