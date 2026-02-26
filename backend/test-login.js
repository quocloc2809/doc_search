// Test login API directly
// Run: node test-login.js

const fetch = require('node-fetch');

async function testLogin() {
    try {
        console.log('Testing login API...\n');

        const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'Admin@123'
            })
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        const data = await response.json();
        console.log('\nResponse:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n✅ Login thành công!');
        } else {
            console.log('\n❌ Login thất bại:', data.message);
        }

    } catch (error) {
        console.error('❌ Lỗi kết nối:', error.message);
        console.log('\nKiểm tra:');
        console.log('1. API Gateway có đang chạy? (port 3001)');
        console.log('2. Auth Service có đang chạy? (port 3002)');
        console.log('3. Database có kết nối được không?');
    }
}

testLogin();
