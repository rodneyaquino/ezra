.PHONY: help install test happy decline report clean

TEST_FILES = tests/e2e-booking.spec.ts tests/payment-decline.spec.ts

help:
	@echo "Available targets:"
	@echo "  make install   -> install npm dependencies"
	@echo "  make test      -> run the main headed test suite"
	@echo "  make booking     -> run the successful booking test headed"
	@echo "  make decline   -> run the declined payment test headed"
	@echo "  make report    -> open the Playwright HTML report"
	@echo "  make clean     -> remove Playwright reports and test artifacts"

install:
	npm install

test:
	npx playwright test --headed $(TEST_FILES)

booking:
	npx playwright test --headed tests/e2e-booking.spec.ts

decline:
	npx playwright test --headed tests/payment-decline.spec.ts

report:
	npx playwright show-report

clean:
	rm -rf playwright-report test-results
