# Localhost SSL Certificate

To use Ledger wallet we have to use https://localhost:3000 and for it we need to
use a SSL certificate.

```shell
cd certs
#  Create the private key
openssl genrsa -out localhost-key.pem 2048

# Use the configuration file to generate the CSR
openssl req -new -key localhost-key.pem -out localhost.csr -config localhost.conf

# Create the self-signed certificate
openssl x509 -req -in localhost.csr -signkey localhost-key.pem -out localhost.pem -days 365 -extfile v3.ext

# Import the certificate to Certificate Authorities in chrome or your local certificates.
```


## Important 
### Import the certificate to Certificate Authorities in Chrome or your local certificates.


# localrethink.finance
```shell
cd certs
#  Create the private key
openssl genrsa -out localhost-key.pem 2048

# Use the configuration file to generate the CSR
openssl req -new -key localhost-key.pem -out localrethink.csr -config localrethink.conf

# Create the self-signed certificate
openssl x509 -req -in localrethink.csr -signkey localhost-key.pem -out localrethink.pem -days 365 -extfile v3localrethink.ext

# Import the certificate to Certificate Authorities in chrome or your local certificates.
```
