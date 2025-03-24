#!/bin/bash

# Clean the dist directory
rm -rf dist

# Rebuild the project
npm run build

# Run tests
npm test
