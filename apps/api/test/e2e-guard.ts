// setupFiles de jest-e2e.json: corre antes de cada archivo e2e (ver e2e-base.ts).
import { prepararBaseE2E } from './e2e-base';

const error = prepararBaseE2E(process.env);
if (error) throw new Error(error);
