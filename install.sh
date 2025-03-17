#!/bin/bash

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}      MANGA-SCALER INSTALLER        ${NC}"
echo -e "${BLUE}=====================================${NC}"

# Buat direktori komik jika belum ada
mkdir -p komik

# 1. Cek apakah bun.sh terinstall
echo -e "\n${YELLOW}[1/2] Memeriksa instalasi Bun...${NC}"
if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓ Bun sudah terinstall!${NC}"
    bun --version
else
    echo -e "${YELLOW}⚠ Bun belum terinstall, mencoba install...${NC}"
    # Install bun menggunakan curl
    curl -fsSL https://bun.sh/install | bash
    
    # Muat ulang shell path
    export PATH="$HOME/.bun/bin:$PATH"
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null
    
    # Cek lagi apakah berhasil
    if command -v bun &> /dev/null; then
        echo -e "${GREEN}✓ Bun berhasil diinstall!${NC}"
        bun --version
    else
        echo -e "${RED}✗ Gagal menginstall Bun. Silakan install manual dari https://bun.sh${NC}"
        exit 1
    fi
fi

# 2. Cek apakah waifu2x sudah ada dan penanganan path
echo -e "\n${YELLOW}[2/2] Memeriksa instalasi waifu2x...${NC}"

# Default path untuk waifu2x (relatif ke direktori project)
DEFAULT_WAIFU2X_DIR="$(pwd)/tools/waifu2x"
WAIFU2X_PATH=""

# Deteksi OS
OS=$(uname -s 2>/dev/null || echo "Unknown")
# Deteksi Windows melalui MSYSTEM (Git Bash) atau WSL
if [[ "$OS" = "Unknown" && -n "$MSYSTEM" ]] || [[ -n "$WINDIR" ]]; then
    OS="Windows"
elif [[ "$OS" = "Linux" && "$(uname -r)" == *Microsoft* ]]; then
    OS="Windows-WSL"
fi

echo -e "${YELLOW}Terdeteksi OS: $OS${NC}"

# Jika Windows, sesuaikan path executable
if [[ "$OS" = "Windows" || "$OS" = "Windows-WSL" ]]; then
    WAIFU2X_EXE="waifu2x-ncnn-vulkan.exe"
else
    WAIFU2X_EXE="waifu2x-ncnn-vulkan"
fi

# Cek apakah path default ada dan memiliki waifu2x
if [ -f "$DEFAULT_WAIFU2X_DIR/$WAIFU2X_EXE" ] && ([ -x "$DEFAULT_WAIFU2X_DIR/$WAIFU2X_EXE" ] || [[ "$OS" = "Windows" ]] || [[ "$OS" = "Windows-WSL" ]]); then
    WAIFU2X_PATH="$DEFAULT_WAIFU2X_DIR/$WAIFU2X_EXE"
    echo -e "${GREEN}✓ waifu2x sudah terinstall di $WAIFU2X_PATH${NC}"
else
    # Jika tidak ada di path default, cek di path alternatif
    ALT_WAIFU2X_DIR="$HOME/Repos/tools/waifu2x"
    if [ -f "$ALT_WAIFU2X_DIR/$WAIFU2X_EXE" ] && ([ -x "$ALT_WAIFU2X_DIR/$WAIFU2X_EXE" ] || [[ "$OS" = "Windows" ]] || [[ "$OS" = "Windows-WSL" ]]); then
        WAIFU2X_PATH="$ALT_WAIFU2X_DIR/$WAIFU2X_EXE"
        echo -e "${GREEN}✓ waifu2x sudah terinstall di $WAIFU2X_PATH${NC}"
    else
        # Jika tidak ditemukan di manapun, tanyakan ke user
        echo -e "${YELLOW}⚠ waifu2x belum terinstall.${NC}"
        read -p "Dimana Anda ingin menginstall waifu2x? (default: $DEFAULT_WAIFU2X_DIR): " USER_WAIFU2X_DIR
        
        # Gunakan input user atau default
        WAIFU2X_DIR=${USER_WAIFU2X_DIR:-$DEFAULT_WAIFU2X_DIR}
        WAIFU2X_PATH="$WAIFU2X_DIR/$WAIFU2X_EXE"
        
        echo -e "${YELLOW}Akan menginstall waifu2x di: $WAIFU2X_DIR${NC}"
        
        # Deteksi arsitektur
        ARCH=$(uname -m 2>/dev/null || echo "x86_64")
        
        echo -e "${YELLOW}Terdeteksi arsitektur: $ARCH${NC}"
        
        # Tentukan URL download dengan dukungan Windows dan ARM yang lebih baik
        if [[ "$OS" = "Windows" || "$OS" = "Windows-WSL" ]]; then
            echo -e "${YELLOW}Terdeteksi Windows atau WSL, menggunakan installer Windows...${NC}"
            DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20220728/waifu2x-ncnn-vulkan-20220728-windows.zip"
        elif [ "$OS" = "Linux" ]; then
            if [ "$ARCH" = "x86_64" ]; then
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-ubuntu.zip"
            elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ] || [ "$ARCH" = "armv7l" ] || [[ "$ARCH" == arm* ]]; then
                echo -e "${YELLOW}Terdeteksi arsitektur ARM: $ARCH${NC}"
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-ubuntu-arm64.zip"
                
                # Periksa dependensi untuk ARM
                echo -e "${YELLOW}Memeriksa dependensi untuk ARM...${NC}"
                if ! command -v vulkaninfo &> /dev/null; then
                    echo -e "${YELLOW}⚠ Vulkan tidak terdeteksi. Mencoba install dependensi Vulkan...${NC}"
                    if command -v apt-get &> /dev/null; then
                        sudo apt-get update && sudo apt-get install -y libvulkan1 vulkan-tools
                    elif command -v dnf &> /dev/null; then
                        sudo dnf install -y vulkan-loader vulkan-tools
                    else
                        echo -e "${YELLOW}⚠ Tidak dapat menginstall Vulkan otomatis. Silakan install Vulkan secara manual.${NC}"
                    fi
                fi
            else
                echo -e "${RED}✗ Arsitektur $ARCH belum didukung secara langsung.${NC}"
                echo -e "${YELLOW}Mencoba menggunakan versi ARM64 sebagai fallback...${NC}"
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-ubuntu-arm64.zip"
            fi
        elif [ "$OS" = "Darwin" ]; then
            if [ "$ARCH" = "x86_64" ]; then
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-macos.zip"
            elif [ "$ARCH" = "arm64" ] || [[ "$ARCH" == arm* ]]; then
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-macos-arm64.zip"
            else
                echo -e "${RED}✗ Arsitektur $ARCH belum didukung secara langsung.${NC}"
                echo -e "${YELLOW}Mencoba menggunakan versi ARM64 sebagai fallback...${NC}"
                DOWNLOAD_URL="https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest/download/waifu2x-ncnn-vulkan-20220728-macos-arm64.zip"
            fi
        else
            echo -e "${RED}✗ OS $OS tidak didukung.${NC}"
            exit 1
        fi
        
        # Buat direktori jika belum ada
        mkdir -p "$WAIFU2X_DIR"
        
        # Download dan ekstrak waifu2x
        echo -e "${YELLOW}Mendownload waifu2x dari $DOWNLOAD_URL${NC}"
        TMP_FILE="/tmp/waifu2x.zip"
        curl -L "$DOWNLOAD_URL" -o "$TMP_FILE"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Gagal mendownload waifu2x.${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}Mengekstrak waifu2x ke $WAIFU2X_DIR${NC}"
        unzip -o "$TMP_FILE" -d "$WAIFU2X_DIR"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Gagal mengekstrak waifu2x.${NC}"
            exit 1
        fi
        
        rm "$TMP_FILE"
        
        # Pastikan file executable (kecuali di Windows)
        if [[ "$OS" != "Windows" && "$OS" != "Windows-WSL" ]]; then
            chmod +x "$WAIFU2X_PATH"
        fi
        
        # Verifikasi instalasi
        if [ -f "$WAIFU2X_PATH" ]; then
            echo -e "${GREEN}✓ waifu2x berhasil diinstall di $WAIFU2X_PATH${NC}"
            
            # Pesan tambahan untuk Windows
            if [[ "$OS" = "Windows" || "$OS" = "Windows-WSL" ]]; then
                echo -e "${YELLOW}Catatan: Di Windows, pastikan Anda memiliki driver Vulkan terinstall di sistem Anda.${NC}"
                echo -e "${YELLOW}Download driver Vulkan dari situs resmi kartu grafis Anda (NVIDIA, AMD, Intel)${NC}"
            fi
        else
            echo -e "${RED}✗ Gagal menginstall waifu2x. Silakan install manual dari https://github.com/nihui/waifu2x-ncnn-vulkan/releases/latest${NC}"
            exit 1
        fi
    fi
fi

# Update .env dengan path waifu2x
echo -e "\n${YELLOW}Memperbarui konfigurasi WAIFU2X_PATH di .env...${NC}"

# Install dependensi node jika belum
echo -e "\n${YELLOW}Menginstall dependensi Node...${NC}"
bun install

# Periksa apakah .env file sudah ada
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}File .env belum ada, membuat dari template...${NC}"
    cp env.example .env
fi

# Update WAIFU2X_PATH di .env
if grep -q "WAIFU2X_PATH" .env; then
    # Jika ada, update nilai
    sed -i.bak "s|WAIFU2X_PATH=.*|WAIFU2X_PATH=\"$WAIFU2X_PATH\"|g" .env && rm -f .env.bak
else
    # Jika tidak ada, tambahkan
    echo "WAIFU2X_PATH=\"$WAIFU2X_PATH\"" >> .env
fi

echo -e "${GREEN}✓ File .env berhasil diperbarui dengan WAIFU2X_PATH=$WAIFU2X_PATH${NC}"

# Tampilkan info penggunaan
echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}      INSTALASI SELESAI!              ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo -e "\n${BLUE}Cara Penggunaan:${NC}"
echo -e "${YELLOW}1. Mencari manga dari komiku.id:${NC}"
echo -e "   ${GREEN}bun scrap${NC}"
echo -e "   Anda akan diminta URL atau kata kunci pencarian"
echo -e "\n${YELLOW}2. Menjalankan server lokal:${NC}"
echo -e "   ${GREEN}bun serve${NC}"
echo -e "   Server akan berjalan di http://localhost:3000"
echo -e "\n${YELLOW}3. Melihat hasil di browser:${NC}"
echo -e "   Buka http://localhost:3000 di browser anda"

echo -e "\n${BLUE}Selamat membaca manga Full HD! 📚${NC}"
