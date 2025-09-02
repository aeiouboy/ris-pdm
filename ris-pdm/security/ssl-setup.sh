#!/bin/bash

# SSL/TLS Certificate Setup Script for RIS Performance Dashboard
# This script sets up SSL certificates for production deployment

set -e

# Configuration
DOMAIN="${DOMAIN:-ris-dashboard.com}"
EMAIL="${EMAIL:-admin@ris-dashboard.com}"
CERT_DIR="${CERT_DIR:-./docker/nginx/ssl}"

echo "🔐 Setting up SSL certificates for $DOMAIN"

# Create certificate directory
mkdir -p "$CERT_DIR"

# Function to generate self-signed certificates for development
generate_self_signed() {
    echo "📝 Generating self-signed certificates for development..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"
    
    echo "✅ Self-signed certificates generated"
}

# Function to obtain Let's Encrypt certificates
generate_letsencrypt() {
    echo "🌐 Obtaining Let's Encrypt certificates..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "❌ Certbot is not installed. Please install it first:"
        echo "   Ubuntu/Debian: sudo apt-get install certbot"
        echo "   CentOS/RHEL: sudo yum install certbot"
        echo "   macOS: brew install certbot"
        exit 1
    fi
    
    # Obtain certificate
    sudo certbot certonly --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "api.$DOMAIN"
    
    # Copy certificates to our directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/key.pem"
    sudo chown $USER:$USER "$CERT_DIR"/*.pem
    
    echo "✅ Let's Encrypt certificates obtained"
}

# Function to setup certificate renewal
setup_renewal() {
    echo "🔄 Setting up certificate renewal..."
    
    # Create renewal script
    cat > ./scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

DOMAIN="${DOMAIN:-ris-dashboard.com}"
CERT_DIR="${CERT_DIR:-./docker/nginx/ssl}"

echo "🔄 Renewing SSL certificates..."

# Renew certificates
sudo certbot renew --quiet

# Copy renewed certificates
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/key.pem"
    sudo chown $USER:$USER "$CERT_DIR"/*.pem
    
    # Reload nginx
    docker-compose exec nginx nginx -s reload 2>/dev/null || echo "⚠️ Could not reload nginx"
    
    echo "✅ Certificates renewed successfully"
else
    echo "❌ Certificate renewal failed"
    exit 1
fi
EOF
    
    chmod +x ./scripts/renew-ssl.sh
    
    # Add to crontab (runs twice daily)
    (crontab -l 2>/dev/null; echo "0 */12 * * * $(pwd)/scripts/renew-ssl.sh >> $(pwd)/logs/ssl-renewal.log 2>&1") | crontab -
    
    echo "✅ Certificate renewal scheduled"
}

# Function to verify certificates
verify_certificates() {
    echo "🔍 Verifying certificates..."
    
    if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
        echo "❌ Certificates not found"
        return 1
    fi
    
    # Check certificate validity
    openssl x509 -in "$CERT_DIR/cert.pem" -text -noout > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Certificates are valid"
        
        # Show certificate details
        echo "📋 Certificate details:"
        openssl x509 -in "$CERT_DIR/cert.pem" -subject -dates -noout
    else
        echo "❌ Certificate validation failed"
        return 1
    fi
}

# Create scripts directory
mkdir -p ./scripts

# Main execution
case "${1:-auto}" in
    "dev"|"development")
        generate_self_signed
        ;;
    "prod"|"production")
        generate_letsencrypt
        setup_renewal
        ;;
    "renew")
        ./scripts/renew-ssl.sh
        ;;
    "verify")
        verify_certificates
        ;;
    "auto")
        if [ "$NODE_ENV" = "production" ]; then
            generate_letsencrypt
            setup_renewal
        else
            generate_self_signed
        fi
        ;;
    *)
        echo "Usage: $0 [dev|prod|renew|verify|auto]"
        echo "  dev    - Generate self-signed certificates for development"
        echo "  prod   - Obtain Let's Encrypt certificates for production"
        echo "  renew  - Renew existing certificates"
        echo "  verify - Verify existing certificates"
        echo "  auto   - Automatically choose based on NODE_ENV"
        exit 1
        ;;
esac

verify_certificates

echo "🎉 SSL setup completed successfully!"
echo "📁 Certificates stored in: $CERT_DIR"
echo "🔧 Update your nginx configuration to use HTTPS"