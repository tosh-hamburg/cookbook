fetch('http://cookbook-backend:4002/api/health')
  .then(r => r.json())
  .then(d => console.log('Backend health:', JSON.stringify(d)))
  .catch(e => console.error('Error:', e.message));
