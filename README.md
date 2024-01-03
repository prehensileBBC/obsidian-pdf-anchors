
# obsidian-pdf-anchors

Exports a note to PDF, preserving links to headings in the same note.

## Use cases & features

If you want to export a long PDF document containing a table of contents and / or clickable links to section headings within the same document, this plugin is for you!

Optionally, this plugin can also generate an _outline view_, sometimes called _bookmarks_ - essentially, the clickable tree view you can use in a PDF reader application to jump between sections of the document. By default, this is switched on; you can turn this off in the plugin settings.

## Using the plugin
Once installed, you can use the "PDF Anchors: Export to PDF with header links" in Obsidian's command palette or file menu. It will export a PDF using Obsidian's usual export process, and then ask to open the PDF you just exported. Once this is opened, it will fix header links in the exported PDF.

## Known bugs
- Headings which wrap onto more than one line in the PDF may not be picked up while generating an outline view.

## Developer notes
This plugin is a workaround for the minimal PDF export Obsidian provides by default. It's made possible by a quirk I observed in Obsidian's PDF export process: external links (e.g to http:// and https:// URLs) survive the export process, but anchor links (to headings in the same document) don't. 

This is the export process used by the plugin:
1. copy the note to be exported to a temporary file,
2. replace all anchor links in the copied note with dummy http links,
3. export the temporary note to PDF using Obsidian's built-in PDF export process,
4. transform all dummy links in the exported pdf to links to pages in the pdf where corresponding headers appear
5. delete the temporary note file

It's a pretty hacky workaround in other words; more brittle than I'd like and likely to break if anything changes in the way Obsidian's PDF export process works. Ideally, I'd like to see this plugin be made obsolete by equivalent features being implemented in Obsdian itself - until then, this hacky plugin will have to do :D 

### Pull requests welcome

Also: I'll be honest with you: javascript / typescript is not my favourite programming language, especially when it comes to async stuff. There are places in the code where I basically just threw async / await around until it worked, and I've also liberally used ! where optional properties most probably exist, just to get this thing done. Pull requests are welcome to tidy things up :D
