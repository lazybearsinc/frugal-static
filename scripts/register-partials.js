const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

async function registerPartials() {
    const partialsDir = path.join(__dirname, '..', 'templates', 'partials');
    
    try {
        const files = await fs.readdir(partialsDir);
        
        for (const file of files) {
            if (file.endsWith('.hbs')) {
                const partialName = path.basename(file, '.hbs');
                const partialContent = await fs.readFile(path.join(partialsDir, file), 'utf-8');
                Handlebars.registerPartial(partialName, partialContent);
                console.log(`✓ Registered partial: ${partialName}`);
            }
        }
    } catch (error) {
        console.error('Error registering partials:', error);
        throw error;
    }
}

module.exports = registerPartials; 