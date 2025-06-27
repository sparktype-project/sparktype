import os
import fnmatch
import argparse

def concatenate_files(root_dir, output_file):
    extensions = ('*.ts', '*.tsx', '*.js', '*.jsx', '*.css', '*.html', '*.json', '*.hbs')
    excluded_dirs = {'node_modules', 'ios', 'public'}
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Write header with directory structure info
        outfile.write(f"FILE CONCATENATION REPORT\n")
        outfile.write(f"Root Directory: {root_dir}\n")
        outfile.write(f"Excluded Directories: {', '.join(excluded_dirs)}\n")
        outfile.write(f"File Extensions: {', '.join(extensions)}\n")
        outfile.write("="*80 + "\n\n")
        
        for root, dirs, files in os.walk(root_dir):
            # Remove excluded directories from dirs list to prevent os.walk from traversing them
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            
            for pattern in extensions:
                for filename in fnmatch.filter(files, pattern):
                    filepath = os.path.join(root, filename)
                    relative_path = os.path.relpath(filepath, root_dir)
                    # Normalize path separators for consistent display
                    normalized_path = relative_path.replace('\\', '/')
                    
                    # Extract folder structure
                    folder_parts = normalized_path.split('/')[:-1]  # Remove filename
                    folder_structure = '/'.join(folder_parts) if folder_parts else '(root)'
                    
                    outfile.write(f"File: {normalized_path}\n")
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                    except UnicodeDecodeError:
                        outfile.write(f"Error: Unable to read {normalized_path} - file may be binary or encoded.\n")
                    outfile.write("\n\n" + "="*80 + "\n\n")

def main():
    parser = argparse.ArgumentParser(description="Concatenate files with specific extensions from a directory.")
    parser.add_argument("root_dir", help="Root directory to start searching from")
    parser.add_argument("output_file", help="Name of the output file")
    args = parser.parse_args()
    
    concatenate_files(args.root_dir, args.output_file)
    print(f"Concatenation complete. Output written to {args.output_file}")

if __name__ == "__main__":
    main()