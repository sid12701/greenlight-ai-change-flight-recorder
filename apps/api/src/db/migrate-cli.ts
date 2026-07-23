#!/usr/bin/env node
import { createDatabase } from "./migrate.js";

const path = process.env.GREENLIGHT_DATABASE_PATH ?? "./data/greenlight.db";
createDatabase(path);
console.log(`migrated ${path}`);
