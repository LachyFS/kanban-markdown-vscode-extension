import '@testing-library/jest-dom'
import * as l10n from '@vscode/l10n'
import enBundle from '../l10n/bundle.l10n.en.json'

l10n.config({ contents: enBundle })
