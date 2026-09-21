# Netlify build script — generates config.js from environment variable
# Set GEMINI_API_KEY in Netlify dashboard → Site Settings → Environment Variables

cat > config.js << EOF
window.GEMINI_CONFIG = {
  apiKey: '${GEMINI_API_KEY}',
  model:  '${GEMINI_MODEL:-gemini-3.5-flash-lite}'
};
EOF

echo "config.js generated successfully"
