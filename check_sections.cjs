const fs = require('fs');
const content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');
const lines = content.split('\n');

// Correct section boundaries based on actual file structure
const sections = {
    'AddModal': [1761, 1906],
    'EditModal': [1761, 1906],  
    'Alert': [2008, 2023],
    'DeleteItem': [2025, 2078],
    'DeductModal': [2080, 2261],
    'TransferModal': [2263, 2403],
    'ReturnModal': [2406, 2585],
    'MovementsModal': [2587, 2726],
    'EditMovementModal': [2729, 2846],
    'DeleteMovementModal': [2849, 2895],
};

for (const [name, [start, end]] of Object.entries(sections)) {
    let opens = 0; let closes = 0;
    for (let l = start - 1; l < end; l++) {
        const line = lines[l];
        let i = 0;
        while (i < line.length) {
            if (line[i] === '`') {
                i++;
                while (i < line.length && line[i] !== '`') {
                    if (line[i] === '$' && i+1 < line.length && line[i+1] === '{') {
                        let d = 1; i += 2;
                        while (i < line.length && d > 0) { if (line[i] === '{') d++; else if (line[i] === '}') d--; i++; }
                    } else i++;
                }
                if (i < line.length) i++;
                continue;
            }
            if (line.substring(i, i+4) === '<div' && (line[i+4] === ' ' || line[i+4] === '>' || line[i+4] === '/' || i+4 >= line.length)) {
                opens++;
                i += 4;
                continue;
            }
            if (line.substring(i, i+6) === '</div>') {
                closes++;
                i += 6;
                continue;
            }
            i++;
        }
    }
    const diff = opens - closes;
    console.log(name + ': opens=' + opens + ' closes=' + closes + ' diff=' + diff + (diff !== 0 ? ' ***' : ''));
}
