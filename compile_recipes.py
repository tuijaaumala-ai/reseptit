import os
import re
import json
from pathlib import Path
from bs4 import BeautifulSoup

def clean_text(text):
    if not text:
        return ""
    text = text.replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def read_file_with_encoding(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read(), 'utf-8'
    except UnicodeDecodeError:
        with open(path, 'r', encoding='cp1252') as f:
            return f.read(), 'cp1252'

def parse_recipe_file(html_path):
    html_content, encoding = read_file_with_encoding(html_path)
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Main container
    main_td = None
    pohja_table = soup.find('table', class_='pohja') or soup.find('TABLE', class_='pohja')
    if pohja_table:
        main_td = pohja_table.find('td') or pohja_table.find('TD')
    
    if not main_td:
        main_td = soup.find('body') or soup.find('BODY') or soup

    # Find relevant tags linearly
    elements = main_td.find_all(['h3', 'H3', 'p', 'P', 'table', 'TABLE'])
    
    title = ""
    desc_p_tags = []
    ingredients_table = None
    instr_p_tags = []
    
    state = 'desc'
    
    for el in elements:
        tag_name = el.name.lower()
        if tag_name == 'h3':
            if not title:
                title = clean_text(el.get_text())
        elif tag_name == 'table':
            if 'pohja' in el.get('class', []):
                continue
            if not ingredients_table:
                ingredients_table = el
                state = 'instr'
        elif tag_name == 'p':
            text = clean_text(el.get_text())
            if not text or "StatCounter" in text or "sc_project" in text or "sc_security" in text:
                continue
            if state == 'desc':
                desc_p_tags.append(el)
            else:
                instr_p_tags.append(el)

    if not title:
        title_tag = soup.find('title') or soup.find('TITLE')
        if title_tag:
            title = clean_text(title_tag.get_text())
        else:
            title = html_path.stem.capitalize()

    # Process ingredients into structured list of dicts: {"amount": "...", "name": "..."}
    ingredients = []
    if ingredients_table:
        for tr in ingredients_table.find_all(['tr', 'TR']):
            tds = tr.find_all(['td', 'TD'])
            if not tds:
                continue
            
            cols = [clean_text(td.get_text()) for td in tds]
            while cols and not cols[-1]:
                cols.pop()
                
            if not cols:
                continue
                
            if len(cols) == 1:
                ingredients.append({
                    "amount": "",
                    "name": cols[0]
                })
            elif len(cols) >= 2:
                col1 = cols[0]
                col2 = " ".join(cols[1:])
                if col1 and col2:
                    ingredients.append({
                        "amount": col1,
                        "name": col2
                    })
                elif col1:
                    ingredients.append({
                        "amount": "",
                        "name": col1
                    })
                elif col2:
                    ingredients.append({
                        "amount": "",
                        "name": col2
                    })

    # Get clean arrays of text
    description_paragraphs = [clean_text(p.get_text()) for p in desc_p_tags if clean_text(p.get_text())]
    instructions_paragraphs = [clean_text(p.get_text()) for p in instr_p_tags if clean_text(p.get_text())]

    return {
        "id": html_path.stem,
        "title": title,
        "description": description_paragraphs,
        "ingredients": ingredients,
        "instructions": instructions_paragraphs
    }

def main():
    root_dir = Path(__file__).parent.resolve()
    html_dir = root_dir / 'html'
    
    html_files = sorted(list(html_dir.glob('*.html')) + list(html_dir.glob('*.htm')))
    
    print(f"Aloitetaan reseptien tietojen kääntäminen. Tiedostoja löydetty: {len(html_files)}")
    
    recipes_list = []
    for html_file in html_files:
        try:
            recipe_data = parse_recipe_file(html_file)
            recipes_list.append(recipe_data)
        except Exception as e:
            print(f"VIRHE tiedoston {html_file.name} käsittelyssä: {e}")
            
    # Write to recipes.js
    output_js_path = root_dir / 'recipes.js'
    
    json_data = json.dumps(recipes_list, ensure_ascii=False, indent=2)
    js_content = f"// Reseptitietokanta automaattisesti käännettynä HTML-tiedostoista\nwindow.RECIPES = {json_data};\n"
    
    with open(output_js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Valmis! Kirjoitettu {len(recipes_list)} reseptiä tiedostoon: {output_js_path.name}")

if __name__ == '__main__':
    main()
