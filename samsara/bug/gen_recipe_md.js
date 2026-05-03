import fs from 'fs';

const recipes = JSON.parse(fs.readFileSync('./recipes_recipes.json', 'utf8'));
const items = JSON.parse(fs.readFileSync('./items_items.json', 'utf8'));

const itemMap = {};
for (const item of items) {
    itemMap[item.code] = item.name;
}

const categorized = {};

for (const r of recipes) {
    const cat = r.category || 'other';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(r);
}

let md = '# Danh Sách Các Công Thức Chế Tạo (Recipes)\n\n';

for (const cat in categorized) {
    md += `## ${cat.toUpperCase()}\n`;
    md += `| Mã Công Thức (recipe_code) | Mã SP (output_code) | Tên Vật Phẩm | Tỷ lệ thành công | Realm |\n`;
    md += `|---|---|---|---|---|\n`;
    
    // sort by recipe_code
    categorized[cat].sort((a, b) => a.recipe_code.localeCompare(b.recipe_code));

    for (const r of categorized[cat]) {
        const rate = r.success_rate !== null ? `${r.success_rate}%` : '100%';
        const realm = r.meta && r.meta.realm_code ? r.meta.realm_code : '-';
        const itemName = itemMap[r.output_code] || '(Không rõ tên)';
        md += `| \`${r.recipe_code}\` | \`${r.output_code}\` | **${itemName}** | ${rate} | ${realm} |\n`;
    }
    md += '\n';
}

fs.writeFileSync('recipe_list_artifact.md', md);
console.log("Generated recipe_list_artifact.md with item names");
