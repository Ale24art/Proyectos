# Moodle Local — Entorno de desarrollo replicable

Repositorio de configuración para restaurar el entorno local de **Moodle 5.0.6**
en cualquier máquina Linux/Debian.

> El código fuente de Moodle **no está incluido** aquí (440 MB, descargable
> desde moodle.org). Este repositorio contiene solo lo que es único a esta
> instalación: dump de BD, plantilla de configuración y scripts.

---

## Contenido del repositorio

```
Moodle_local/
├── config.php.example   # plantilla de config.php sin credenciales reales
├── dump_db.sh           # script para generar/actualizar el dump SQL
├── db/
│   └── moodle_dump.sql  # volcado completo de la base de datos
└── README.md
```

---

## Requisitos previos (en la máquina destino)

| Componente | Versión usada |
|---|---|
| PHP | 8.4 |
| MariaDB | 11.8 |
| Apache2 | 2.4 |
| Moodle | **5.0.6 (Build: 20260216)** |

---

## Pasos para restaurar el entorno

### 1. Instalar dependencias del sistema

```bash
sudo apt update
sudo apt install apache2 mariadb-server php8.4 php8.4-mysql php8.4-xml \
     php8.4-mbstring php8.4-curl php8.4-zip php8.4-gd php8.4-intl \
     php8.4-soap libapache2-mod-php8.4
```

### 2. Descargar Moodle 5.0.6

```bash
wget https://download.moodle.org/download.php/direct/stable500/moodle-5.0.6.tgz
tar -xzf moodle-5.0.6.tgz
sudo mv moodle /var/www/moodle
sudo chown -R www-data:www-data /var/www/moodle
```

### 3. Crear la carpeta moodledata

```bash
sudo mkdir -p /var/www/moodledata
sudo chown -R www-data:www-data /var/www/moodledata
sudo chmod 02777 /var/www/moodledata
```

### 4. Crear la base de datos e importar el dump

```bash
sudo mariadb -e "CREATE DATABASE moodle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mariadb -e "CREATE USER 'moodleuser'@'localhost' IDENTIFIED BY 'TU_CONTRASEÑA_NUEVA';"
sudo mariadb -e "GRANT ALL PRIVILEGES ON moodle.* TO 'moodleuser'@'localhost';"
sudo mariadb -e "FLUSH PRIVILEGES;"

sudo mariadb moodle < db/moodle_dump.sql
```

### 5. Configurar config.php

```bash
sudo cp config.php.example /var/www/moodle/config.php
sudo nano /var/www/moodle/config.php
```

Ajustar estas líneas:

```php
$CFG->dbuser    = 'moodleuser';
$CFG->dbpass    = 'TU_CONTRASEÑA_NUEVA';
$CFG->wwwroot   = 'http://localhost';    // o http://localhost:8080
$CFG->dataroot  = '/var/www/moodledata';
```

```bash
sudo chown www-data:www-data /var/www/moodle/config.php
sudo chmod 640 /var/www/moodle/config.php
```

### 6. Configurar Apache

```bash
sudo tee /etc/apache2/sites-available/moodle.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/moodle

    <Directory /var/www/moodle>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/moodle_error.log
    CustomLog ${APACHE_LOG_DIR}/moodle_access.log combined
</VirtualHost>
EOF

sudo a2ensite moodle.conf
sudo a2enmod rewrite
sudo systemctl reload apache2
```

### 7. Verificar

Abrir en el navegador: **http://localhost**

---

## Actualizar el dump (en el Chromebook origen)

```bash
cd ~/GitHub/Proyectos/Moodle_local
./dump_db.sh
git add db/moodle_dump.sql
git commit -m "chore: actualizar dump de BD"
git push
```

---

## Notas sobre moodledata

`moodledata` contiene archivos subidos por usuarios (~4,164 archivos).
Para una réplica completa con todo el contenido multimedia:

```bash
# En origen (Chromebook): comprimir
sudo tar -czf moodledata_backup.tar.gz -C /var/www moodledata
# Transferir al destino y extraer en /var/www/
```

Para desarrollo sin contenido real, con `moodledata` vacía es suficiente.
