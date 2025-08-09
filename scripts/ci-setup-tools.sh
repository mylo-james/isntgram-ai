#!/bin/bash

# CI Tools Setup Script
# Installs and configures all industry-standard CI testing tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Homebrew if not present
install_homebrew() {
    if ! command_exists brew; then
        print_step "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        print_status "Homebrew installed"
    else
        print_status "Homebrew already installed"
    fi
}

# Function to install Act
install_act() {
    if ! command_exists act; then
        print_step "Installing Act..."
        brew install act
        print_status "Act installed"
    else
        print_status "Act already installed"
    fi
}

# Function to install Go
install_go() {
    if ! command_exists go; then
        print_step "Installing Go..."
        brew install go
        print_status "Go installed"
    else
        print_status "Go already installed"
    fi
}

# Function to install actionlint
install_actionlint() {
    if ! command_exists actionlint; then
        print_step "Installing actionlint..."
        go install github.com/rhysd/actionlint/cmd/actionlint@latest
        print_status "actionlint installed"
    else
        print_status "actionlint already installed"
    fi
}

# Function to install yamllint
install_yamllint() {
    if ! command_exists yamllint; then
        print_step "Installing yamllint..."
        pip install yamllint
        print_status "yamllint installed"
    else
        print_status "yamllint already installed"
    fi
}

# Function to configure shell profile
configure_shell_profile() {
    print_step "Configuring shell profile..."
    
    local shell_profile=""
    if [[ "$SHELL" == *"zsh"* ]]; then
        shell_profile="$HOME/.zshrc"
    elif [[ "$SHELL" == *"bash"* ]]; then
        shell_profile="$HOME/.bashrc"
    else
        shell_profile="$HOME/.bash_profile"
    fi
    
    # Add Go bin to PATH if not already there
    local go_bin_path="$(go env GOPATH)/bin"
    if ! grep -q "$go_bin_path" "$shell_profile" 2>/dev/null; then
        echo "" >> "$shell_profile"
        echo "# Add Go bin to PATH for CI tools" >> "$shell_profile"
        echo "export PATH=\$PATH:$go_bin_path" >> "$shell_profile"
        print_status "Added Go bin to PATH in $shell_profile"
    else
        print_status "Go bin already in PATH"
    fi
}

# Function to verify installations
verify_installations() {
    print_step "Verifying installations..."
    
    local all_good=true
    
    if command_exists act; then
        print_status "Act: $(act --version)"
    else
        print_error "Act: Not found"
        all_good=false
    fi
    
    if command_exists actionlint; then
        print_status "actionlint: $(actionlint --version)"
    else
        print_error "actionlint: Not found (may need to restart shell)"
        all_good=false
    fi
    
    if command_exists yamllint; then
        print_status "yamllint: $(yamllint --version)"
    else
        print_error "yamllint: Not found"
        all_good=false
    fi
    
    if [ "$all_good" = true ]; then
        print_status "All tools installed successfully!"
    else
        print_warning "Some tools may need shell restart to be available"
    fi
}

# Function to test CI workflow
test_ci_workflow() {
    print_step "Testing CI workflow..."
    
    if [ -f ".github/workflows/ci.yml" ]; then
        print_step "Testing with actionlint..."
        if command_exists actionlint; then
            actionlint .github/workflows/ci.yml
            print_status "actionlint passed"
        fi
        
        print_step "Testing with yamllint..."
        if command_exists yamllint; then
            yamllint .github/workflows/ci.yml
            print_status "yamllint completed"
        fi
        
        print_step "Testing with Act..."
        if command_exists act; then
            act --list
            print_status "Act configuration looks good"
        fi
    else
        print_warning "No CI workflow found at .github/workflows/ci.yml"
    fi
}

# Function to show usage
show_usage() {
    print_header "CI Tools Usage"
    echo ""
    echo "Available commands:"
    echo "  npm run test:ci      # Basic validation"
    echo "  npm run test:ci:pro  # Professional testing"
    echo ""
    echo "Direct tool usage:"
    echo "  act --list           # List available jobs"
    echo "  act -j quality       # Run quality job"
    echo "  act -j integration   # Run integration job"
    echo "  actionlint .github/workflows/ci.yml  # Lint workflow"
    echo "  yamllint .github/workflows/ci.yml    # Validate YAML"
    echo ""
    echo "For M1/M2 Macs, use:"
    echo "  act -j quality --container-architecture linux/amd64"
}

# Main function
main() {
    print_header "Setting up CI Testing Tools"
    echo "Installing industry-standard tools for CI/CD validation"
    echo ""
    
    # Install tools
    install_homebrew
    install_act
    install_go
    install_actionlint
    install_yamllint
    
    # Configure environment
    configure_shell_profile
    
    # Verify installations
    verify_installations
    
    # Test workflow
    test_ci_workflow
    
    # Show usage
    show_usage
    
    print_status "Setup complete! 🎉"
    echo ""
    print_warning "Note: You may need to restart your shell or run:"
    echo "  source ~/.zshrc  # or ~/.bashrc"
    echo ""
    print_warning "Then you can run:"
    echo "  npm run test:ci:pro"
}

# Run main function
main "$@"
