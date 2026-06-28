## Architecture Correction: Use Local AI Model, No Anthropic API

Phase 1 and Phase 2 are already completed.

Now modify the architecture to remove dependency on Anthropic API / Claude API.

We want the ERP AI Report Assistant to run using a **local open-source AI model**.

## Main Change

Do not use:

* Anthropic API
* Claude API key
* OpenAI API key
* Any paid external LLM API

Use a locally hosted model instead.

## Preferred Architecture

Use:

* Local LLM server using Ollama / vLLM / llama.cpp
* Spring Boot backend calls local AI endpoint
* AI model runs inside our own server
* Database schema metadata is passed to the model
* Report SQL is generated locally
* SQL is validated by backend before execution

## Important Requirement

The AI model must not directly access the database.

Flow should be:

1. User asks report question.
2. Spring Boot receives request.
3. Backend prepares safe metadata context.
4. Backend sends prompt to local model.
5. Local model returns report plan + SQL.
6. Backend validates SQL.
7. Backend executes only safe SELECT query.
8. Result is shown in React table.
9. User can download Excel.

## Local Model Options

Recommend suitable models for our ERP reporting use case.

Consider models like:

* Llama 3.1 / 3.3
* Qwen2.5-Coder
* DeepSeek-Coder
* Mistral
* CodeLlama

Select the best model for:

* SQL generation
* business report understanding
* running locally
* reasonable hardware requirement
* future fine-tuning

## Training Strategy

Do not directly train first.

Use this phased approach:

### Phase A: Local Model Setup

* Download selected model
* Run it locally using Ollama or vLLM
* Test prompt-based SQL generation

### Phase B: RAG / Metadata Training

Instead of full fine-tuning initially, create a knowledge base containing:

* ERP table definitions
* column meanings
* allowed joins
* report examples
* business terminology
* existing report SQL
* sample user questions

Use this as context for the local model.

### Phase C: Fine-Tuning Later

Fine-tune only after collecting enough data:

* user question
* expected report
* approved SQL
* corrected SQL
* business explanation

Create training dataset in JSONL format.

## Required Changes in Existing Architecture

Update the architecture documents and code design to include:

1. Local LLM service
2. Model download and setup steps
3. No external API key dependency
4. Model selection recommendation
5. RAG knowledge base design
6. Fine-tuning dataset design
7. Local inference API contract
8. Spring Boot integration with local model
9. Docker Compose setup for local AI service
10. Hardware recommendation
11. Security rules for generated SQL
12. Fallback when model gives invalid SQL

## Suggested Local AI Service

Create separate service:

`erp-ai-local-service`

Responsibilities:

* communicate with local model
* build prompts
* retrieve metadata context
* generate SQL
* return structured JSON response
* never execute SQL

## Expected AI Response Format

The local model must return only JSON:

```json
{
  "reportTitle": "Branch-wise Sales Summary",
  "intent": "sales_summary",
  "explanation": "This report shows total sales grouped by branch.",
  "sql": "SELECT ...",
  "filters": [
    {
      "name": "fromDate",
      "type": "date",
      "required": true
    }
  ],
  "columns": [
    {
      "name": "branch_name",
      "label": "Branch"
    },
    {
      "name": "total_sales",
      "label": "Total Sales"
    }
  ],
  "confidence": 0.91
}
```

## Very Important

The backend must reject the response if:

* response is not valid JSON
* SQL is not SELECT
* SQL contains dangerous keywords
* tenant filter is missing
* branch permission is missing
* query has no row limit
* unknown table or column is used
* unsupported join is used

## Deliverables Needed

Update the existing Phase 1 and Phase 2 architecture to support this local model approach.

Generate:

1. Revised architecture diagram explanation
2. Updated backend service design
3. Updated API design
4. Local model setup guide
5. Ollama/vLLM integration design
6. RAG metadata design
7. Fine-tuning plan
8. Docker Compose file
9. Sample Spring Boot code to call local model
10. Sample prompt templates
11. SQL validation rules
12. Testing checklist
