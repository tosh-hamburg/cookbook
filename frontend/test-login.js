fetch('http://localhost:3002/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
  .then(r => r.json())
  .then(d => console.log('Login result:', JSON.stringify(d, null, 2)))
  .catch(e => console.error('Error:', e.message));
