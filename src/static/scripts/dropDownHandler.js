document.addEventListener('DOMContentLoaded', function() {
            const userInput = document.getElementById('userInput');
            const sendButton = document.getElementById('sendButton');
            const dropdownOptions = document.getElementById('dropdownOptions');
            const strategyDropdown = document.getElementById('strategyDropdown');
            const strategyOptions = document.getElementById('strategyOptions');
            const modelDropdown = document.getElementById('modelDropdown');
            const modelOptions = document.getElementById('modelOptions');
            
            // Store selections
            const modelSelections = {};
            const selectedStrategies = new Set();
            
            // Fetch config from the server
            fetch('/api/config')
                .then(response => response.json())
                .then(data => {
                    const qaPairs = data.qa_pairs || [];
                    const models = data.models || [];
                    const strategies = data.strategies || [];
                    
                    populateDropdown(qaPairs);
                    populateStrategyDropdown(strategies);
                    populateModelDropdown(models);
                })
                .catch(error => {
                    console.error('Error fetching config:', error);
                });
            
            function populateDropdown(qaPairs) {
                dropdownOptions.innerHTML = '';
                
                qaPairs.forEach(pair => {
                    const optionItem = document.createElement('div');
                    optionItem.className = 'option-item draggable';
                    optionItem.textContent = pair[0];
                    optionItem.draggable = true;
                    
                    optionItem.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', pair[0]);
                    });
                    
                    optionItem.addEventListener('click', () => {
                        userInput.value = pair[0];
                        dropdownOptions.classList.remove('show');
                    });
                    
                    dropdownOptions.appendChild(optionItem);
                });
            }
            
            function populateStrategyDropdown(strategies) {
                strategyOptions.innerHTML = '';
                
                strategies.forEach(strategy => {
                    const optionItem = document.createElement('div');
                    optionItem.className = 'option-item';
                    optionItem.textContent = strategy;
                    optionItem.dataset.value = strategy;
                    
                    optionItem.addEventListener('click', () => {
                        if (selectedStrategies.has(strategy)) {
                            selectedStrategies.delete(strategy);
                            optionItem.classList.remove('selected');
                        } else {
                            selectedStrategies.add(strategy);
                            optionItem.classList.add('selected');
                        }
                        console.log('Selected strategies:', Array.from(selectedStrategies));
                    });
                    
                    strategyOptions.appendChild(optionItem);
                });
            }
            
            function populateModelDropdown(models) {
                modelOptions.innerHTML = '';
                
                models.forEach(model => {
                    const modelOption = document.createElement('div');
                    modelOption.className = 'model-option';
                    
                    const modelName = document.createElement('span');
                    modelName.className = 'model-name';
                    modelName.textContent = model;
                    
                    const checkboxes = document.createElement('div');
                    checkboxes.className = 'model-checkboxes';
                    
                    const outputCheckbox = createCheckbox(model, 'output', 'Output');
                    const PromptCheckbox = createCheckbox(model, 'prompt', 'Prompt');
                    
                    checkboxes.appendChild(outputCheckbox);
                    checkboxes.appendChild(PromptCheckbox);
                    
                    modelOption.appendChild(modelName);
                    modelOption.appendChild(checkboxes);
                    modelOptions.appendChild(modelOption);
                    
                    // Initialize model selections
                    modelSelections[model] = {
                        output: false,
                        prompt: false
                    };
                });
            }
            
            function createCheckbox(model, type, label) {
                const container = document.createElement('label');
                container.className = 'model-checkbox-label';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.model = model;
                checkbox.dataset.type = type;
                
                checkbox.addEventListener('change', function() {
                    modelSelections[model][type] = this.checked;
                    console.log('Model selections:', modelSelections);
                });
                
                container.appendChild(checkbox);
                container.appendChild(document.createTextNode(label));
                
                return container;
            }
            
            // Strategy dropdown toggle
            strategyDropdown.addEventListener('click', function(e) {
                e.stopPropagation();
                const isActive = strategyOptions.classList.contains('show');
                
                // Close all dropdowns first
                closeAllDropdowns();
                
                if (!isActive) {
                    strategyOptions.classList.add('show');
                    strategyDropdown.classList.add('active');
                }
            });
            
            // Model dropdown toggle
            modelDropdown.addEventListener('click', function(e) {
                e.stopPropagation();
                const isActive = modelOptions.classList.contains('show');
                
                // Close all dropdowns first
                closeAllDropdowns();
                
                if (!isActive) {
                    modelOptions.classList.add('show');
                    modelDropdown.classList.add('active');
                }
            });
            
            // QA pairs input focus
            userInput.addEventListener('focus', () => {
                closeAllDropdowns();
                if (dropdownOptions.children.length > 0) {
                    dropdownOptions.classList.add('show');
                }
            });
            
            function closeAllDropdowns() {
                strategyOptions.classList.remove('show');
                modelOptions.classList.remove('show');
                dropdownOptions.classList.remove('show');
                strategyDropdown.classList.remove('active');
                modelDropdown.classList.remove('active');
            }
            
            // Close dropdowns when clicking outside
            document.addEventListener('click', function(e) {
                if (!strategyDropdown.contains(e.target) && !strategyOptions.contains(e.target) &&
                    !modelDropdown.contains(e.target) && !modelOptions.contains(e.target) &&
                    !userInput.contains(e.target) && !dropdownOptions.contains(e.target)) {
                    closeAllDropdowns();
                }
            });
            
            // Prevent closing when clicking inside dropdowns
            strategyOptions.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            modelOptions.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            dropdownOptions.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            // Drag and drop functionality
            userInput.addEventListener('dragover', (e) => {
                e.preventDefault();
                userInput.classList.add('drag-over');
            });
            
            userInput.addEventListener('dragleave', () => {
                userInput.classList.remove('drag-over');
            });
            
            userInput.addEventListener('drop', (e) => {
                e.preventDefault();
                userInput.classList.remove('drag-over');
                userInput.value = e.dataTransfer.getData('text/plain');
            });
            
            // Send button functionality
            sendButton.addEventListener('click', function() {
                const selectedModels = Object.entries(modelSelections)
                    .filter(([model, selections]) => selections.output || selections.prompt)
                    .reduce((acc, [model, selections]) => {
                        acc[model] = selections;
                        return acc;
                    }, {});
            });
        });