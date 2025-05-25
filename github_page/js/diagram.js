document.addEventListener('DOMContentLoaded', function() {
    console.log('diagram.js loaded and DOMContentLoaded event fired.');
    const diagramContainer = document.getElementById('system-diagram');
    const componentDetails = document.getElementById('component-details');
    let svg; // Declare svg here
    let activeElement = null; // To keep track of the currently active element (for tooltips)

    const components = {
        'User': {
            name: 'Пользователь',
            description: 'Взаимодействует с системой голосовыми командами.',
            icon: 'fas fa-user',
            type: 'input'
        },
        'AdobeVoiceUI': {
            name: 'Adobe Voice UI (Eel/Python)',
            description: 'Клиентское приложение, предоставляющее пользовательский интерфейс для голосового ввода и отображения информации.',
            icon: 'fas fa-microphone',
            type: 'app'
        },
        'VoiceCommandAPI': {
            name: 'VoiceCommandAPI (Flask)',
            description: 'Серверная часть, обрабатывающая голосовые команды и взаимодействующая с LLM.',
            icon: 'fas fa-server',
            type: 'api'
        },
        'GoogleGeminiLLM': {
            name: 'Google Gemini LLM',
            description: 'Большая языковая модель, используемая для семантического анализа и преобразования голосовых команд в структурированные данные.',
            icon: 'fas fa-brain',
            type: 'llm'
        },
        'PremierePro': {
            name: 'Adobe Premiere Pro',
            description: 'Целевое приложение для видеомонтажа, управляемое командами.',
            icon: 'fas fa-video',
            type: 'app'
        }
    };

    const connections = [
        { from: 'User', to: 'AdobeVoiceUI', label: 'Голосовая команда', description: 'Пользователь произносит голосовую команду.' },
        { from: 'AdobeVoiceUI', to: 'VoiceCommandAPI', label: 'Запрос JSON интерпретацию', description: 'Транскрибированная команда отправляется на сервер для обработки.' },
        { from: 'VoiceCommandAPI', to: 'GoogleGeminiLLM', label: 'Интерпретация LLM', description: 'API использует LLM для анализа и интерпретации команды.' },
        { from: 'GoogleGeminiLLM', to: 'VoiceCommandAPI', label: 'Структурированный ответ', description: 'LLM возвращает структурированный JSON-ответ.' },
        { from: 'VoiceCommandAPI', to: 'AdobeVoiceUI', label: 'Выполнение команды', description: 'API отправляет команду обратно клиентскому приложению.' },
        { from: 'AdobeVoiceUI', to: 'PremierePro', label: 'Выполнение команды', description: 'Клиентское приложение выполняет команду в Adobe Premiere Pro.' }
    ];

    function showDetails(element, title, description, event) {
        componentDetails.innerHTML = `<h5>${title}</h5><p>${description}</p>`;

        // Temporarily make visible to get offsetHeight/offsetWidth
        componentDetails.style.display = 'block';
        componentDetails.style.visibility = 'hidden';
        componentDetails.style.left = '0';
        componentDetails.style.top = '0';
        componentDetails.style.transform = 'none';

        const diagramContainerRect = diagramContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect(); // Get rect of the clicked element

        // Position tooltip relative to the clicked element
        let tooltipX = elementRect.left - diagramContainerRect.left + elementRect.width / 2;
        let tooltipY = elementRect.top - diagramContainerRect.top - componentDetails.offsetHeight - 10; // Position above the element

        // Adjust if it goes above the diagram container
        if (tooltipY < 0) {
             tooltipY = elementRect.top - diagramContainerRect.top + elementRect.height + 10; // Position below the element
        }

        // Center horizontally relative to the element
        tooltipX = tooltipX - componentDetails.offsetWidth / 2;

         // Adjust if it goes outside the right boundary of the diagram container
        if (tooltipX + componentDetails.offsetWidth > diagramContainerRect.width) {
             tooltipX = diagramContainerRect.width - componentDetails.offsetWidth - 10;
        }

        // Adjust if it goes outside the left boundary of the diagram container
        if (tooltipX < 0) {
             tooltipX = 10;
        }


        componentDetails.style.left = `${tooltipX}px`;
        componentDetails.style.top = `${tooltipY}px`;
        componentDetails.style.transform = `none`; // Remove center transform as we adjusted X
        componentDetails.style.visibility = 'visible';

        activeElement = element; // Set the active element
    }

    function hideDetails() {
        componentDetails.style.display = 'none';
        activeElement = null; // Clear the active element
    }

    function createDiagram() {
        console.log('createDiagram() called.');
        // Create nodes
        for (const id in components) {
            const component = components[id];
            const node = document.createElement('div');
            node.classList.add('diagram-node', component.type + '-node');
            node.id = `node-${id}`;
            node.innerHTML = `<i class="${component.icon}"></i><span>${component.name}</span>`;
            node.dataset.componentId = id;
            diagramContainer.appendChild(node);
            console.log(`Node created: ${node.id}`);

            // Add click event listener for nodes
            node.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent click from bubbling up to document
                 if (activeElement === node) {
                    hideDetails(); // Hide if clicking the same element
                 } else {
                    const component = components[id];
                    showDetails(node, component.name, component.description, e);
                 }
            });

             // Remove mouseover/mouseout listeners
             node.removeEventListener('mouseover', () => {});
             node.removeEventListener('mouseout', () => {});
        }

        positionElements();
    }

    function positionElements() {
        console.log('positionElements() called.');
        svg = document.getElementById('diagram-arrows'); // Assign to the global svg
        const containerRect = diagramContainer.getBoundingClientRect();
        svg.setAttribute('width', containerRect.width);
        svg.setAttribute('height', containerRect.height);
        svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
        svg.innerHTML = ''; // Clear previous arrows

        // Define arrowhead marker
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        arrowhead.setAttribute('id', 'arrowhead');
        arrowhead.setAttribute('viewBox', '0 0 10 10');
        arrowhead.setAttribute('refX', '7');
        arrowhead.setAttribute('refY', '5');
        arrowhead.setAttribute('markerWidth', '6');
        arrowhead.setAttribute('markerHeight', '6');
        arrowhead.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowhead.appendChild(path);
        defs.appendChild(arrowhead);
        svg.appendChild(defs);

        // Set node positions (these are still hardcoded for now, will improve later)
        const nodePositions = {
            'User': { top: 50, left: 50 },
            'AdobeVoiceUI': { top: 50, left: 300 },
            'VoiceCommandAPI': { top: 250, left: 450 },
            'GoogleGeminiLLM': { top: 50, left: 700 },
            'PremierePro': { top: 450, left: 300 }
        };

        for (const id in nodePositions) {
            const node = document.getElementById(`node-${id}`);
            if (node) {
                node.style.top = `${nodePositions[id].top}px`;
                node.style.left = `${nodePositions[id].left}px`;
            }
        }

        // Draw SVG connections
        connections.forEach((conn) => {
            const fromNode = document.getElementById(`node-${conn.from}`);
            const toNode = document.getElementById(`node-${conn.to}`);

            if (fromNode && toNode) {
                // Get the actual rendered positions of the nodes relative to the container
                const fromX = fromNode.offsetLeft + fromNode.offsetWidth / 2;
                const fromY = fromNode.offsetTop + fromNode.offsetHeight / 2;
                const toX = toNode.offsetLeft + toNode.offsetWidth / 2;
                const toY = toNode.offsetTop + toNode.offsetHeight / 2;
                console.log(`Drawing line from ${conn.from} (${fromX}, ${fromY}) to ${conn.to} (${toX}, ${toY})`);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', fromX);
                line.setAttribute('y1', fromY);
                line.setAttribute('x2', toX);
                line.setAttribute('y2', toY);
                line.setAttribute('stroke', '#333');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                line.classList.add('diagram-line');
                line.dataset.from = conn.from;
                line.dataset.to = conn.to;
                line.dataset.description = conn.description; // Add description to line dataset
                line.dataset.label = conn.label; // Add label to line dataset

                svg.appendChild(line);

                // Add label to the line
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', (fromX + toX) / 2);
                text.setAttribute('y', (fromY + toY) / 2 - 10);
                text.setAttribute('fill', '#333');
                text.setAttribute('font-size', '12');
                text.setAttribute('text-anchor', 'middle');
                text.textContent = conn.label;
                text.classList.add('diagram-label');
                text.dataset.description = conn.description; // Add description to label dataset
                text.dataset.label = conn.label; // Add label to label dataset
                svg.appendChild(text);

                // Add click events for lines and labels
                const elementsToClick = [line, text];
                elementsToClick.forEach(el => {
                    el.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent click from bubbling up to document
                         if (activeElement === el) {
                            hideDetails(); // Hide if clicking the same element
                         } else {
                            const description = el.dataset.description;
                            const label = el.dataset.label;
                            showDetails(el, label, description, e);
                         }
                    });
                     // Remove mouseover/mouseout listeners
                    el.removeEventListener('mouseover', () => {});
                    el.removeEventListener('mouseout', () => {});
                });
            }
        });
    }

    let animationInterval;
    let currentAnimationStep = 0;
    const animationSpeed = 1500; // Speed of each step in ms
    const restartDelay = 2000; // Delay before restarting the loop in ms

    function animateWorkflow() {
        console.log('animateWorkflow() called.');
        const lines = svg.querySelectorAll('.diagram-line');
        const labels = svg.querySelectorAll('.diagram-label');

        // Clear previous interval if any
        if (animationInterval) {
            clearTimeout(animationInterval);
        }

        function runStep() {
            // Reset all highlights
            document.querySelectorAll('.diagram-node').forEach(node => node.classList.remove('highlight'));
            lines.forEach(line => {
                 line.classList.remove('highlight');
                 line.style.strokeDasharray = ''; // Reset dasharray
                 line.style.strokeDashoffset = ''; // Reset dashoffset
            });
            labels.forEach(label => label.classList.remove('highlight'));

            if (currentAnimationStep < connections.length) {
                const conn = connections[currentAnimationStep];
                const fromNode = document.getElementById(`node-${conn.from}`);
                const toNode = document.getElementById(`node-${conn.to}`);
                // Find the correct line element using data attributes
                const line = svg.querySelector(`.diagram-line[data-from="${conn.from}"][data-to="${conn.to}"]`);
                // Find the correct label element using data attributes or text content
                // Using text content might be fragile if labels are not unique, using index or another attribute is better
                // For now, let's find the label by text content and approximate position
                const label = Array.from(labels).find(lbl => lbl.textContent === conn.label &&
                                                            Math.abs(parseFloat(lbl.getAttribute('x')) - (fromNode.offsetLeft + fromNode.offsetWidth/2 + toNode.offsetLeft + toNode.offsetWidth/2)/2) < 50 &&
                                                            Math.abs(parseFloat(lbl.getAttribute('y')) - ((fromNode.offsetTop + fromNode.offsetHeight/2 + toNode.offsetTop + toNode.offsetHeight/2)/2 - 10)) < 50
                                                           );


                if (fromNode) fromNode.classList.add('highlight');
                if (toNode) toNode.classList.add('highlight');
                if (line) {
                    line.classList.add('highlight');
                    const length = line.getTotalLength();
                    line.style.strokeDasharray = length;
                    line.style.strokeDashoffset = length;
                     // Trigger reflow to apply the initial state before animating
                    line.getBoundingClientRect();
                     line.style.strokeDashoffset = '0'; // Animate to 0
                }
                if (label) label.classList.add('highlight');

                // Display description of the current step
                // Position it in the lower right corner of the diagram
                 const diagramRect = diagramContainer.getBoundingClientRect();
                 const tooltipX = diagramRect.width - componentDetails.offsetWidth - 20;
                 const tooltipY = diagramRect.height - componentDetails.offsetHeight - 20;

                 showDetails(diagramContainer, conn.label, conn.description, {pageX: diagramRect.right - componentDetails.offsetWidth - 20, pageY: diagramRect.bottom - componentDetails.offsetHeight - 20}); // Use diagramContainer to position relative to it, pass dummy event coords


                currentAnimationStep++;
                animationInterval = setTimeout(runStep, animationSpeed);
            } else {
                currentAnimationStep = 0; // Reset for loop
                hideDetails(); // Hide tooltip at the end of animation cycle
                animationInterval = setTimeout(runStep, restartDelay); // Delay before restarting the loop
            }
        }

        runStep(); // Start the first step
    }

    function stopAnimation() {
        clearTimeout(animationInterval);
        // Reset all highlights when stopping
        document.querySelectorAll('.diagram-node').forEach(node => node.classList.remove('highlight'));
        svg.querySelectorAll('.diagram-line').forEach(line => {
             line.classList.remove('highlight');
             line.style.strokeDasharray = ''; // Reset dasharray
             line.style.strokeDashoffset = ''; // Reset dashoffset
        });
        svg.querySelectorAll('.diagram-label').forEach(label => label.classList.remove('highlight'));
         hideDetails(); // Hide tooltip when stopping animation
    }

    // Event listener for the animation toggle button
    const toggleAnimationBtn = document.getElementById('toggle-animation-btn');
    let isAnimating = false;

    toggleAnimationBtn.addEventListener('click', () => {
        if (isAnimating) {
            stopAnimation();
            toggleAnimationBtn.textContent = 'Запустить анимацию';
            isAnimating = false;
        } else {
            animateWorkflow();
            toggleAnimationBtn.textContent = 'Остановить анимацию';
            isAnimating = true;
        }
    });

    // Hide tooltip when clicking anywhere on the document except the tooltip itself
    document.addEventListener('click', function(event) {
        const isClickInsideDiagram = diagramContainer.contains(event.target);
        const isClickInsideTooltip = componentDetails.contains(event.target);

        if (!isClickInsideDiagram && !isClickInsideTooltip) {
            hideDetails();
        }
    });


    createDiagram();
    positionElements(); // Ensure elements are positioned initially

    // Optional: Recalculate positions on window resize
     window.addEventListener('resize', positionElements);
});
