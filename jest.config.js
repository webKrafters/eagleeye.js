module.exports = {
	collectCoverageFrom: [
		'src/**/*.ts',
		'src/**/*.tsx'
	],
	coveragePathIgnorePatterns: [
		'src/constants',
		'src/test-artifacts',
		'src/main/test-apps',
		'src/index.ts'
	],
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json',
			diagnostics: false
		}
	},
	setupFiles: [
		'<rootDir>/setupTests.js'
	],
	transform: {
		'\\.[jt]sx?$': 'ts-jest'
	}
};
