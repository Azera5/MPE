// 'Templates', 'auto-PE', 'Rephrasing', 'L-Reference', 'C-Reference'


// based on https://arxiv.org/pdf/2311.11482
function returnBasicTemplate(prompt) {
    return `
        Task: Prompt Revision to Enhance Reasoning Capabilities.
            1. Original Question: Let's think step by step. ${prompt}
            2. Goal: Transform the original prompt into a enhanced version while preserving its core objectives.
            3. Transformation Instructions:
                (a) Retain the primary purpose and objectives.
                (b) Introduce scenarios that challenge conventional thinking, if necessary.
                (c) Provide a few-shot setting with examples, if necessary.
                (d) Decompose the problem into manageable components, if necessary.
                (e) Use clear, direct language, and structure the prompt with bullet points or numbered steps for clarity.
            4. Outcome: The revised prompt should be sufficiently detailed to guide effective task completion.
        `;
}

// based on https://arxiv.org/pdf/2311.11482
function returnBasicSystemPrompt() {
    return `
        You are a specialized prompt engineer with extensive expertise in effective communication. Your task is to revise input prompts to ensure they:
            1. Activate deeper cognitive processes.
            2. Uncover potential reasoning errors.
            3. Clearly interpret and understand the presented question.
        Work methodically and always preserve the prompt's structure as a question under any circumstances.
        `;
}

function useBasicTemplate(prompt) {
    return {
        metaPrompt: returnBasicTemplate(prompt),
        systemPrompt: returnBasicSystemPrompt()
    };
}

function adaptBasicTemplate(prompt) {
    return {
        metaPrompt: returnBasicTemplate(prompt),
        systemPrompt: `
        You are a specialized prompt engineer with extensive expertise in meta prompting templates. Your task is to methodically improve a given template and ensure that:
            (a) Adapt the core objectives 2. to 4. to the domain of the original question.
            (b) Keep the core objectives 2. to 4. logical and coherent.
            (c) Keep the original question unchanged under any circumstances.
        The expected output is an improved version of the initial template.
        `
    };
}

// based on https://cobusgreyling.medium.com/meta-prompting-a-practical-guide-to-optimising-prompts-automatically-c0a071f4b664
function useAutoPE(prompt) {
    return {
        metaPrompt: `
        Improve the following question to generate a more reliable answer. 
        Adhere to prompt engineering best practices in order to improve the question. 
        Make sure the structure is clear and intuitive.

        Original question: ${prompt}

        Only return the improved question.`,
        systemPrompt: returnBasicSystemPrompt()
    };
}

function useRephrasing(prompt) {
    return {
        metaPrompt: `
        Original question: ${prompt}
        Your main objectives are:
            1. Implicit requirements hidden in the question have to be made explicit.
            2. Logical contradictions contained in the question have to be phrased as uncertainties.
            3. The Vocabulary has to fit the domain of the question.
        Work methodically and always preserve the prompt's structure as a question under any circumstances. Only return the rephrased question.
        `,
        systemPrompt: `
        You are a specialized prompt engineer with extensive expertise in effective communication. You are able to rephrase even the most challanging questions into accessable and understandable queries.
        `
    };
}

// few-shot prompting with an example from "Einführung in die Wissensrepräsentation" by Prof. Dr. Fabian Neuhaus
function useLReferenceIN(prompt) {
    return {
        metaPrompt: `
        # Example question: What films were directed by David Lynch or George Lucas?
        # SPARQL query:
            PREFIX dbo: <http://dbpedia.org/ontology/>
            PREFIX dbp: <http://dbpedia.org/property/>

            SELECT ?titelEN WHERE {

                { _:1 a dbo:Film;
                rdfs:label ?titelEN;
                dbo:director dbr:David Lynch. }

                UNION

                { _:1 a dbo:Film;
                rdfs:label ?titelEN;
                dbo:director dbr:George Lucas. }
                filter langMatches( lang(?titelEN), ”EN” )

            }
        
        # Real question: ${prompt}
        # SPARQL query: <todo>

        Only return the SPARQL query related to the real question.
    `,
        systemPrompt: `
        You are a specialized prompt engineer with extensive expertise in SPARQL. Your task is to create queries corresponding to user questions. 
        `
    };
}

function useLReferenceOUT(prompt) {
    return {
        metaPrompt: prompt,
        systemPrompt: `
        You are a specialized knowledge representation engineer with extensive expertise in SPARQL. Your task is to translate the results from SPARQL queries into natural language.
        `
    };
}

function useCReference(prompt, outputResult) {
    return {
        metaPrompt: `
        # Challanging question:
        ${prompt}

        # Proposed answer:
        ${outputResult}

        # Improved answer:
        <todo>
        `,
        systemPrompt: `
        You are an expert proofreader for potential answer candidates for challanging questions. Your role is to rigorously assess question-answer pairs and improve the proposed answers. Your main objectives are:
            1. Assure factual accuracy, logical consistency, completeness, and absence of errors.
            2. Assure conciseness, absence of fluff, and strict adherence to the question's scope.
            3. You are only allowed to output the improved answer.
        `
    };
}

