import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

// Temporary sandbox-only config: allows the OpenHands work host to reach the dev server.
// Not part of the project; safe to delete.
export default mergeConfig(base, defineConfig({ server: { allowedHosts: true } }))
