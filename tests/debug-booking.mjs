// Quick debug: check actual booking response
const token = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0901234561', password: 'Password@1' }),
}).then(r => r.json()).then(d => d.data.tokens.accessToken);

console.log('Token:', token?.slice(0, 30) + '...');

const bk = await fetch('http://localhost:3000/api/bookings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    pickupLat: 10.77095, pickupLng: 106.69895,
    pickupAddress: 'Cua Nam Cho Ben Thanh, Q1',
    dropoffLat: 10.79, dropoffLng: 106.705,
    dropoffAddress: 'Nha tho Duc Ba, Q1',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
  }),
}).then(r => r.json());

console.log('Booking response:', JSON.stringify(bk, null, 2));

const bookingId = bk.data?.booking?.id;
if (bookingId) {
  const confirm = await fetch(`http://localhost:3000/api/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ paymentMethod: 'CASH' }),
  }).then(r => r.json());
  console.log('\nConfirm response:', JSON.stringify(confirm, null, 2));
}
