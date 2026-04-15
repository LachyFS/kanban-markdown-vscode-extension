#!/usr/bin/env -S pnpm exec tsx

/**
 * Verifies that all locale bundle files have the same keys as the English bundle.
 * Usage: pnpm exec tsx scripts/check-l10n.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const l10nDir = path.join(__dirname, '..', 'l10n')
const enBundlePath = path.join(l10nDir, 'bundle.l10n.en.json')

if (!fs.existsSync(enBundlePath)) {
  console.error('English bundle not found:', enBundlePath)
  process.exit(1)
}

const enBundle: Record<string, string> = JSON.parse(fs.readFileSync(enBundlePath, 'utf-8'))
const enKeys = new Set(Object.keys(enBundle))

const files = fs.readdirSync(l10nDir).filter(f =>
  f.startsWith('bundle.l10n.') && f.endsWith('.json') && f !== 'bundle.l10n.en.json'
)

if (files.length === 0) {
  console.log('No translation bundles found (only English).')
  process.exit(0)
}

let hasErrors = false

for (const file of files) {
  const locale = file.replace('bundle.l10n.', '').replace('.json', '')
  const bundlePath = path.join(l10nDir, file)
  const bundle: Record<string, string> = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'))
  const bundleKeys = new Set(Object.keys(bundle))

  const missing = [...enKeys].filter(k => !bundleKeys.has(k))
  const extra = [...bundleKeys].filter(k => !enKeys.has(k))

  if (missing.length > 0) {
    hasErrors = true
    console.error(`\n[${locale}] Missing ${missing.length} key(s):`)
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
  }

  if (extra.length > 0) {
    hasErrors = true
    console.error(`\n[${locale}] Extra ${extra.length} key(s) not in English bundle:`)
    for (const key of extra) {
      console.error(`  - ${key}`)
    }
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[${locale}] OK - ${bundleKeys.size} keys match English bundle`)
  }
}

// Also check package.nls files
const nlsEnPath = path.join(__dirname, '..', 'package.nls.json')
if (fs.existsSync(nlsEnPath)) {
  const nlsEn: Record<string, string> = JSON.parse(fs.readFileSync(nlsEnPath, 'utf-8'))
  const nlsEnKeys = new Set(Object.keys(nlsEn))

  const nlsFiles = fs.readdirSync(path.join(__dirname, '..')).filter(f =>
    f.startsWith('package.nls.') && f.endsWith('.json')
  )

  for (const file of nlsFiles) {
    const locale = file.replace('package.nls.', '').replace('.json', '')
    const nlsPath = path.join(__dirname, '..', file)
    const nls: Record<string, string> = JSON.parse(fs.readFileSync(nlsPath, 'utf-8'))
    const nlsKeys = new Set(Object.keys(nls))

    const missing = [...nlsEnKeys].filter(k => !nlsKeys.has(k))
    const extra = [...nlsKeys].filter(k => !nlsEnKeys.has(k))

    if (missing.length > 0) {
      hasErrors = true
      console.error(`\n[package.nls.${locale}] Missing ${missing.length} key(s):`)
      for (const key of missing) {
        console.error(`  - ${key}`)
      }
    }

    if (extra.length > 0) {
      hasErrors = true
      console.error(`\n[package.nls.${locale}] Extra ${extra.length} key(s):`)
      for (const key of extra) {
        console.error(`  - ${key}`)
      }
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log(`[package.nls.${locale}] OK - ${nlsKeys.size} keys match`)
    }
  }
}

if (hasErrors) {
  console.error('\nLocalization check failed.')
  process.exit(1)
} else {
  console.log('\nAll localization files are in sync.')
}
