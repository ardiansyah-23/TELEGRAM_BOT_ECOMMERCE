const fs = require('fs');
const path = require('path');

// 1. Rename api to api_routes
if (!fs.existsSync('api_routes')) {
  fs.renameSync('api', 'api_routes');
}

// 2. Create new api folder
if (!fs.existsSync('api')) {
  fs.mkdirSync('api');
}

// 3. Find all endpoints in api_routes (excluding _ files)
function getEndpoints(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getEndpoints(fullPath, path.join(base, file)));
    } else if (file.endsWith('.ts') && !file.startsWith('_')) {
      results.push(path.join(base, file).replace(/\\/g, '/'));
    }
  }
  return results;
}

const endpoints = getEndpoints('api_routes');

let imports = '';
let switchBody = '';

endpoints.forEach((ep, i) => {
  const routePath = '/api/' + ep.replace(/\.ts$/, '').replace(/\/index$/, '');
  const importName = 'route_' + i;
  imports += `import ${importName} from '../api_routes/${ep.replace(/\.ts$/, '')}';\n`;
  switchBody += `    case '${routePath}': return await ${importName}(req, res);\n`;
});

const fileContent = `import type { VercelRequest, VercelResponse } from '@vercel/node';

${imports}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Vercel req.url could be /api/twa/cart?foo=bar
    const url = new URL(req.url || '/', \`http://\${req.headers.host || 'localhost'}\`);
    let pathName = url.pathname;
    
    // Normalize path by removing trailing slash if exists (except for root)
    if (pathName.length > 1 && pathName.endsWith('/')) {
      pathName = pathName.slice(0, -1);
    }

    switch (pathName) {
${switchBody}
      default:
        return res.status(404).json({ error: 'API Route Not Found: ' + pathName });
    }
  } catch (error) {
    console.error('Error in API Router:', error);
    return res.status(500).json({ error: 'Internal Server Error in Router' });
  }
}
`;

fs.writeFileSync('api/index.ts', fileContent);
console.log('Successfully generated api/index.ts with ' + endpoints.length + ' endpoints.');
