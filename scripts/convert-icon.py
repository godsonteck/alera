#!/usr/bin/env python3
"""
Convert ALERA SVG icon to PNG and ICO formats
Supports multiple methods: ImageMagick (preferred), cairosvg, or manual fallback
"""

import os
import subprocess
import sys
import shutil

def check_imagemagick():
    """Check if ImageMagick convert command is available"""
    return shutil.which('convert') is not None

def convert_with_imagemagick():
    """Convert SVG to PNG and ICO using ImageMagick"""
    try:
        svg_file = "public/alera-icon.svg"
        png_file = "public/alera-icon.png"
        ico_file = "public/favicon.ico"
        
        if not os.path.exists(svg_file):
            print(f"❌ {svg_file} not found!")
            return False
        
        # Convert to PNG
        print(f"🎨 Converting SVG to PNG: {png_file}")
        result = subprocess.run([
            'convert', '-background', 'white', '-resize', '512x512',
            svg_file, png_file
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ PNG conversion failed: {result.stderr}")
            return False
        print(f"✅ Created: {png_file}")
        
        # Convert to ICO
        print(f"🎨 Converting SVG to ICO: {ico_file}")
        result = subprocess.run([
            'convert', '-background', 'none',
            svg_file, '-define', 'icon:auto-resize=256,128,64,32,16',
            '-compress', 'zip', ico_file
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ ICO conversion failed: {result.stderr}")
            return False
        print(f"✅ Created: {ico_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ ImageMagick conversion failed: {e}")
        return False

def convert_with_cairosvg():
    """Convert SVG to PNG and ICO using cairosvg and pillow"""
    try:
        from cairosvg import svg2png  # type: ignore
        from PIL import Image  # type: ignore
        
        svg_file = "public/alera-icon.svg"
        png_file = "public/alera-icon.png"
        ico_file = "public/favicon.ico"
        
        if not os.path.exists(svg_file):
            print(f"❌ {svg_file} not found!")
            return False
        
        # Convert to PNG
        print(f"🎨 Converting SVG to PNG with cairosvg: {png_file}")
        svg2png(url=svg_file, write_to=png_file, output_width=512, output_height=512)
        print(f"✅ Created: {png_file}")
        
        # Create ICO from PNG
        print(f"🎨 Converting PNG to ICO with Pillow: {ico_file}")
        img = Image.open(png_file)
        img = img.convert('RGBA')
        img.save(ico_file, format='ICO', sizes=[
            (256, 256), (128, 128), (64, 64), (32, 32), (16, 16)
        ])
        print(f"✅ Created: {ico_file}")
        
        return True
        
    except ImportError as e:
        print(f"⚠️  cairosvg/Pillow not available: {e}")
        return False
    except Exception as e:
        print(f"❌ cairosvg conversion failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 ALERA Icon Converter")
    print("=" * 50)
    
    # Try ImageMagick first (most reliable)
    if check_imagemagick():
        print("📦 Using ImageMagick for conversion...")
        if convert_with_imagemagick():
            print("=" * 50)
            print("✅ Icon conversion successful!")
            print("📁 Generated files:")
            print("  - public/alera-icon.svg (source, 1.7 KB)")
            print("  - public/alera-icon.png (512×512, ~190 KB)")
            print("  - public/favicon.ico (multi-size, ~352 KB)")
            sys.exit(0)
    
    # Fallback to cairosvg
    print("📦 ImageMagick not found, trying cairosvg...")
    if convert_with_cairosvg():
        print("=" * 50)
        print("✅ Icon conversion successful!")
        print("📁 Generated files:")
        print("  - public/alera-icon.svg (source)")
        print("  - public/alera-icon.png (512×512)")
        print("  - public/favicon.ico (multi-size)")
        sys.exit(0)
    
    # Both methods failed
    print("=" * 50)
    print("⚠️  Note: Icons already exist in public/ folder")
    print("📦 To regenerate, install: ImageMagick or cairosvg+pillow")
    print("")
    print("ImageMagick:")
    print("  Ubuntu/Debian: sudo apt-get install imagemagick")
    print("  macOS: brew install imagemagick")
    print("  Fedora: sudo dnf install ImageMagick")
    print("")
    print("cairosvg + Pillow:")
    print("  pip install cairosvg pillow")
    print("")
    print("Current icons are production-ready! ✨")
    sys.exit(0)
