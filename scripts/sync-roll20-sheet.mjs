import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const filesToSync = [
  {
    source: resolve(projectRoot, 'roll20-sheet/sheet.html'),
    destination: resolve(projectRoot, 'public/roll20-sheet/sheet.html'),
  },
  {
    source: resolve(projectRoot, 'roll20-sheet/sheet.css'),
    destination: resolve(projectRoot, 'public/roll20-sheet/sheet.css'),
  },
]

for (const file of filesToSync) {
  await mkdir(dirname(file.destination), { recursive: true })
  await copyFile(file.source, file.destination)
}

console.log('Synced Roll20 sheet assets to public/roll20-sheet')
