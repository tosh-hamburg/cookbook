fetch('http://localhost:3002/api/health')
  .then(r => r.json())
  .then(d => console.log('Via Vite Proxy:', JSON.stringify(d)))
  .catch(e => console.error('Error:', e.message));
