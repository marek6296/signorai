
import re

def check_structure(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    markers = {
        1592: "Main Return",
        1727: "Create Tab Start",
        1794: "Create Tab End",
        1797: "Discovery Tab Start",
        1962: "Discovery Tab End",
        1963: "Full Automation Tab Start",
        2417: "Full Automation Tab End",
        2420: "Manage Tab Start",
        2610: "Manage Tab End",
        2613: "Analytics Tab Start",
        2916: "Analytics Tab End",
        2918: "Social Tab Start",
    }
    
    braces = 0
    parens = 0
    divs = 0
    
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Track braces and parens for JSX blocks
        for char in line:
            if char == '{': braces += 1
            if char == '}': braces -= 1
            if char == '(': parens += 1
            if char == ')': parens -= 1
            
        # Track divs (simplified)
        divs += len(re.findall(r'<div', line))
        divs -= len(re.findall(r'</div>', line))
        
        if line_num in markers:
            print(f"L{line_num} {markers[line_num]}: Braces={braces}, Parens={parens}, Divs={divs}")

    print(f"Final state: Braces={braces}, Parens={parens}, Divs={divs}")

check_structure('/Users/marek/nove weby 2026/ai news/ai-news-portal/src/app/admin/page.tsx')
