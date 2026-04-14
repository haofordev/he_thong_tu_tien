
import fs from 'fs';
const content = fs.readFileSync('code_game.js', 'utf8');
const regex = /"([\/\-a-zA-Z0-9_\/]+)"/g;
const matches = [...content.matchAll(regex)];
if (matches) {
    const uniqueMatches = [...new Set(matches.map(m => m[1]))];
    console.log(uniqueMatches.filter(m => m.startsWith('/') && (m.includes('mine') || m.includes('mo'))).join('\n'));
} else {
    console.log('No matches');
}
