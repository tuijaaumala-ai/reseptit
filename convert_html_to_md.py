import os
import re
from pathlib import Path
from bs4 import BeautifulSoup

def clean_text(text):
    if not text:
        return ""
    # Normalize whitespaces and replace non-breaking spaces with standard space
    text = text.replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def read_file_with_encoding(path):
    # Try UTF-8 first
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            # If it has cp1252 characters decoded as utf-8 incorrectly (rare but possible),
            # we check if there are invalid characters. But normally, cp1252 will raise UnicodeDecodeError.
            return content, 'utf-8'
    except UnicodeDecodeError:
        # Fall back to cp1252
        with open(path, 'r', encoding='cp1252') as f:
            return f.read(), 'cp1252'

def convert_html_file(html_path):
    html_content, encoding = read_file_with_encoding(html_path)
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Locate main content container TD (from class="pohja" table) or fallback to body/soup
    main_td = None
    pohja_table = soup.find('table', class_='pohja') or soup.find('TABLE', class_='pohja')
    if pohja_table:
        main_td = pohja_table.find('td') or pohja_table.find('TD')
    
    if not main_td:
        main_td = soup.find('body') or soup.find('BODY') or soup

    # Find all relevant elements linearly within the main container
    elements = main_td.find_all(['h3', 'H3', 'p', 'P', 'table', 'TABLE'])
    
    title = ""
    desc_p_tags = []
    ingredients_table = None
    instr_p_tags = []
    
    state = 'desc' # 'desc', 'instr' (switched after table is found)
    
    for el in elements:
        tag_name = el.name.lower()
        if tag_name == 'h3':
            if not title:
                title = clean_text(el.get_text())
        elif tag_name == 'table':
            # Skip outer pohja table if it is in the list
            if 'pohja' in el.get('class', []):
                continue
            # Store the first non-pohja table as ingredients table
            if not ingredients_table:
                ingredients_table = el
                state = 'instr'
        elif tag_name == 'p':
            text = clean_text(el.get_text())
            # Skip StatCounter and empty paragraphs
            if not text or "StatCounter" in text or "sc_project" in text or "sc_security" in text:
                continue
            if state == 'desc':
                desc_p_tags.append(el)
            else:
                instr_p_tags.append(el)

    # Fallback title if H3 is empty
    if not title:
        title_tag = soup.find('title') or soup.find('TITLE')
        if title_tag:
            title = clean_text(title_tag.get_text())
        else:
            title = html_path.stem.capitalize()

    # Process ingredients table
    ingredients = []
    if ingredients_table:
        for tr in ingredients_table.find_all(['tr', 'TR']):
            tds = tr.find_all(['td', 'TD'])
            if not tds:
                continue
            
            cols = [clean_text(td.get_text()) for td in tds]
            # Strip empty cells from the right
            while cols and not cols[-1]:
                cols.pop()
                
            if not cols:
                continue
                
            if len(cols) == 1:
                ingredients.append(f"- {cols[0]}")
            elif len(cols) >= 2:
                col1 = cols[0]
                col2 = " ".join(cols[1:])
                if col1 and col2:
                    ingredients.append(f"- **{col1}** {col2}")
                elif col1:
                    ingredients.append(f"- {col1}")
                elif col2:
                    ingredients.append(f"- {col2}")

    # Build Markdown content
    md = []
    md.append(f"# {title}\n")
    
    # Add descriptions
    desc_texts = [clean_text(p.get_text()) for p in desc_p_tags]
    desc_texts = [t for t in desc_texts if t]
    if desc_texts:
        for desc in desc_texts:
            md.append(f"{desc}\n")
        md.append("") # extra spacing
        
    # Add ingredients
    if ingredients:
        md.append("### Ainekset")
        for ing in ingredients:
            md.append(ing)
        md.append("") # extra spacing
        
    # Add instructions
    instr_texts = [clean_text(p.get_text()) for p in instr_p_tags]
    instr_texts = [t for t in instr_texts if t]
    if instr_texts:
        md.append("### Ohjeet")
        for instr in instr_texts:
            md.append(f"{instr}\n")
            
    return "\n".join(md).strip() + "\n"

def main():
    root_dir = Path(__file__).parent.resolve()
    html_dir = root_dir / 'html'
    md_dir = root_dir / 'md'
    
    # Create the output directory
    md_dir.mkdir(exist_ok=True)
    
    # Find all html/htm files
    html_files = sorted(list(html_dir.glob('*.html')) + list(html_dir.glob('*.htm')))
    
    print(f"Löydettiin {len(html_files)} HTML-tiedostoa käsiteltäväksi.")
    
    converted_count = 0
    for html_file in html_files:
        try:
            md_content = convert_html_file(html_file)
            
            # The output filename will have .md extension
            md_filename = html_file.stem + '.md'
            md_file_path = md_dir / md_filename
            
            with open(md_file_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
                
            converted_count += 1
            print(f"Muunnettu: {html_file.name} -> {md_filename}")
        except Exception as e:
            print(f"VIRHE tiedoston {html_file.name} käsittelyssä: {e}")
            
    print(f"\nMuunnos valmis! Muunnettiin onnistuneesti {converted_count}/{len(html_files)} tiedostoa.")

if __name__ == '__main__':
    main()
