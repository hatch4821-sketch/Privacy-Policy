const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const markdownItTaskLists = require('markdown-it-task-lists');
const hljs = require('highlight.js');
const markdownItMathjax3 = require('markdown-it-mathjax3');
const markdownItEmoji = require('markdown-it-emoji').full;
const markdownItAnchor = require('markdown-it-anchor');

const markdownsDir = path.join(__dirname, '../Markdowns');
const htmlDir = path.join(__dirname, '../Html');
const readmePath = path.join(__dirname, '../README.md');

function toHumanReadable(filename) {
    let name = filename.replace(/\.html$/i, '');
    name = name.replace(/[-_]/g, ' ');
    return name.replace(/\b\w/g, char => char.toUpperCase());
}

// Custom encode covering '(',')','!','*',"'" which standard encoding skips (protects MD links)
function safeEncode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

try {
    const md = new MarkdownIt({ 
        html: true, 
        linkify: true, 
        typographer: true,
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return '<pre class="hljs"><code>' +
                           hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                           '</code></pre>';
                } catch (__) {}
            }
            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        }
    })
    .use(markdownItTaskLists)
    .use(markdownItMathjax3)
    .use(markdownItEmoji)
    .use(markdownItAnchor);

    if (!fs.existsSync(htmlDir)) {
        console.log(`[INFO] Creating Html directory at ${htmlDir}`);
        fs.mkdirSync(htmlDir, { recursive: true });
    }

    if (!fs.existsSync(markdownsDir)) {
        console.log(`[WARN] Markdowns directory not found. Exiting cleanly.`);
        process.exit(0);
    }

    const mdFiles = fs.readdirSync(markdownsDir)
        .filter(f => f.toLowerCase().endsWith('.md'))
        .sort();

    // 1) First clean up ghost files, BEFORE any empty array evaluations
    const existingHtmlFiles = fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir).filter(f => f.toLowerCase().endsWith('.html')) : [];
    const expectedHtmlFiles = mdFiles.map(f => f.replace(/\.md$/i, '.html'));

    for (const htmlFile of existingHtmlFiles) {
        if (!expectedHtmlFiles.includes(htmlFile)) {
            fs.unlinkSync(path.join(htmlDir, htmlFile));
            console.log(`[INFO] Deleted orphaned HTML file: ${htmlFile}`);
        }
    }

    // 2) If no policies sit inside Markdowns, we safely exit operations here.
    if (mdFiles.length === 0) {
        console.log('[WARN] No markdown files found in Markdowns directory. Exiting cleanly.');
        process.exit(0);
    }

    let generatedFiles = [];

    // 3) Process Markdown files natively
    for (const file of mdFiles) {
        const mdFilePath = path.join(markdownsDir, file);
        const htmlFileName = file.replace(/\.md$/i, '.html');
        const htmlFilePath = path.join(htmlDir, htmlFileName);
        
        const mdContent = fs.readFileSync(mdFilePath, 'utf8');

        // PRE-PROCESS: Convert spaced local paths (./Test File.md -> ./Test%20File.md) to fix markdown-it failure
        let preprocessedMd = mdContent.replace(/\[([^\]]+)\]\(([^)]+\.md(?:[&?#][^)]*)?)\)/g, (match, text, url) => {
            return `[${text}](${url.replace(/ /g, '%20')})`;
        });
        
        let htmlContent = md.render(preprocessedMd);

        // POST-PROCESS: Update validated links towards HTML formats natively
        htmlContent = htmlContent.replace(/href="([^"]+\.md)([&?#][^"]*)?"/g, (match, p1, p2) => {
            if (p1.startsWith('http://') || p1.startsWith('https://') || p1.startsWith('//')) return match;
            const newPath = p1.substring(0, p1.length - 3) + '.html';
            return `href="${newPath}${p2 || ''}"`;
        });
        
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<!-- Auto-generated from Markdowns/${file}. Do not edit manually. -->
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="privacy-policy-html-generator">
    <title>${toHumanReadable(htmlFileName)}</title>
    <link rel="stylesheet" href="../assets/github-markdown.css">
    <link rel="stylesheet" href="../assets/highlight-github.css">
    <style>
        .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
        }
        @media (max-width: 767px) {
            .markdown-body { padding: 15px; }
        }
    </style>
</head>
<body class="markdown-body">
${htmlContent}
</body>
</html>`;
        
        fs.writeFileSync(htmlFilePath, fullHtml, 'utf8');
        generatedFiles.push({ md: file, html: htmlFileName });
        console.log(`[INFO] Generated HTML for: ${file}`);
    }

    // 4) Manage Safe ReadMe Boundaries
    if (!fs.existsSync(readmePath)) {
        console.error(`[ERROR] README.md not found at ${readmePath}`);
        process.exit(1);
    }

    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    const startMarker = '<!-- AUTO-FILE-LIST-START -->';
    const endMarker = '<!-- AUTO-FILE-LIST-END -->';
    const startIndex = readmeContent.indexOf(startMarker);
    const endIndex = readmeContent.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        let newReadmeList = '\n';
        generatedFiles.forEach((fileInfo, index) => {
            newReadmeList += `${index + 1}. [${fileInfo.md}](./Markdowns/${safeEncode(fileInfo.md)})\n`;
            newReadmeList += `    - Link: [${fileInfo.html}](./Html/${safeEncode(fileInfo.html)})\n\n`;
        });

        readmeContent = readmeContent.substring(0, startIndex + startMarker.length) 
                        + newReadmeList 
                        + readmeContent.substring(endIndex);
        
        fs.writeFileSync(readmePath, readmeContent, 'utf8');
        console.log(`[INFO] Successfully updated README.md with ${generatedFiles.length} links.`);
    } else {
        console.error('[ERROR] Could not find valid <!-- AUTO-FILE-LIST-START --> and <!-- AUTO-FILE-LIST-END --> markers in README.md.');
        process.exit(1);
    }
} catch (error) {
    console.error(`[ERROR] Pipeline failed: ${error.message}`);
    process.exit(1);
}
