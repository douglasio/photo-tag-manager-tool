// Side-effect import so @testing-library/jest-dom's matcher types (toBeInTheDocument,
// toBeDisabled, etc.) augment Vitest's `expect` across every test file compiled in
// this project — vitest.setup.ts imports the runtime half of this at the project
// root, which tsconfig.web.json's include list doesn't cover.
import '@testing-library/jest-dom/vitest'
