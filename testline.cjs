const line = '            {error && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>}';
let opens = 0; let closes = 0;
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
console.log('opens=' + opens + ' closes=' + closes);
