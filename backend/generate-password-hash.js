const crypto = require('crypto');

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// Generate hash cho admin
const adminSalt = generateSalt();
const adminHash = hashPassword('Admin@123', adminSalt);

console.log('=== ADMIN ACCOUNT ===');
console.log('Username: admin');
console.log('Password: Admin@123');
console.log('Salt:', adminSalt);
console.log('Hash:', adminHash);
console.log('');

// Generate hash cho user1
const user1Salt = generateSalt();
const user1Hash = hashPassword('User@123', user1Salt);

console.log('=== USER1 ACCOUNT ===');
console.log('Username: user1');
console.log('Password: User@123');
console.log('Salt:', user1Salt);
console.log('Hash:', user1Hash);
console.log('');

console.log('=== SQL UPDATE COMMANDS ===');
console.log(`-- Update admin password`);
console.log(`UPDATE dbo.Users SET Salt = '${adminSalt}', PasswordHash = '${adminHash}' WHERE Username = 'admin';`);
console.log('');
console.log(`-- Update user1 password`);
console.log(`UPDATE dbo.Users SET Salt = '${user1Salt}', PasswordHash = '${user1Hash}' WHERE Username = 'user1';`);
