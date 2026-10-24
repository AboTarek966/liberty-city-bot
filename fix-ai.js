const fs = require('fs');
const path = 'src/app/dashboard/ai/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the early return block
const startIdx = content.indexOf('if (loading) {');
if (startIdx === -1) {
  console.log('Start not found');
  process.exit(1);
}

// Find the matching closing brace for the if block
let braceCount = 0;
let inString = false;
let stringChar = '';
let i = content.indexOf('{', content.indexOf('if (loading)')) + 1;
while (i < content.length) {
  const char = content[i];
  if (!inString && (char === '"' || char === "'")) {
    inString = true;
    stringChar = content[i];
  } else if (inString && char === stringChar && content[i-1] !== '\\') {
    inString = false;
  } else if (!inString) {
    if (char === '{') braceCount++;
    else if (char === '}') {
      braceCount--;
      if (braceCount === 0) break;
    }
  }
  i++;
}
const ifEndIdx = i + 1;

// Find the next return statement after the if block
const returnIdx = content.indexOf('return (', i);
if (returnIdx === -1) {
  console.log('Second return not found');
  process.exit(1);
}

// Remove the if block and the second return, replace with single return with ternary
const beforeIf = content.slice(0, content.lastIndexOf('\n', content.indexOf('if (loading)')) + 1);
const afterSecondReturn = content.slice(content.indexOf('return (', content.indexOf('return (', content.indexOf('return (') + 1)) + 1);

const newContent = content.slice(0, content.indexOf('if (loading)')) + 
`return (
    <div className="p-6 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-liberty-primary border-t-transparent mx-auto mb-4" />
            <p className="text-gray-400">جاري تحميل إعدادات AI...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">الذكاء الاصطناعي</h1>
              <p className="text-gray-400 mt-1">إدارة ميزات AI: Auto-Mod، Ticket Assistant، Translator</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary">تصدير إعدادات AI</button>
              <button className="btn-primary">حفظ إعدادات AI</button>
            </div>
          </div>
        </>
      )}
    </div>
  );` + 
content.slice(content.indexOf(')', content.indexOf('return (', content.indexOf('return (') + 1)) + 1);

fs.writeFileSync(path, newContent);
console.log('Fixed AI page');