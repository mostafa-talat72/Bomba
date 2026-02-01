import Organization from "../models/Organization.js";

// @desc    Get organization public page
// @route   GET /public/organization/:id
// @access  Public
export const getOrganizationPublicPage = async (req, res) => {
    try {
        const { id } = req.params;
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>المنشأة غير موجودة</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
                    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                    <style>
                        body {
                            font-family: 'Cairo', sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0;
                            color: white;
                            padding: 20px;
                        }
                        .error-container {
                            text-align: center;
                            background: rgba(255, 255, 255, 0.15);
                            padding: 60px 40px;
                            border-radius: 30px;
                            backdrop-filter: blur(20px);
                            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            max-width: 500px;
                            animation: fadeInUp 0.8s ease-out;
                        }
                        @keyframes fadeInUp {
                            from { opacity: 0; transform: translateY(30px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        .error-icon {
                            font-size: 4rem;
                            margin-bottom: 20px;
                            color: #ff6b6b;
                        }
                        h1 { 
                            font-size: 2.5rem; 
                            margin-bottom: 20px; 
                            font-weight: 800;
                        }
                        p { 
                            font-size: 1.3rem; 
                            line-height: 1.6;
                            opacity: 0.9;
                        }
                        .developer-info {
                            margin-top: 30px;
                            padding: 20px;
                            background: rgba(255, 255, 255, 0.1);
                            border-radius: 15px;
                            font-size: 0.9rem;
                            opacity: 0.8;
                        }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h1>المنشأة غير موجودة</h1>
                        <p>عذراً، لم يتم العثور على المنشأة المطلوبة</p>
                        <div class="developer-info">
                            <div>
                                <i class="fas fa-code"></i>
                                تصميم وتطوير: مصطفى طلعت للحلول البرمجية
                            </div>
                            <div style="margin-top: 5px;">
                                <i class="fas fa-phone"></i>
                                01116626164
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        // Generate beautiful HTML page
        const html = generateOrganizationHTML(organization);
        res.send(html);
        
    } catch (error) {
        console.error('Error getting organization public page:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>خطأ في الخادم</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Cairo', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        color: white;
                        padding: 20px;
                    }
                    .error-container {
                        text-align: center;
                        background: rgba(255, 255, 255, 0.15);
                        padding: 60px 40px;
                        border-radius: 30px;
                        backdrop-filter: blur(20px);
                        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        max-width: 500px;
                        animation: fadeInUp 0.8s ease-out;
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(30px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .error-icon {
                        font-size: 4rem;
                        margin-bottom: 20px;
                        color: #ffa726;
                    }
                    h1 { 
                        font-size: 2.5rem; 
                        margin-bottom: 20px; 
                        font-weight: 800;
                    }
                    p { 
                        font-size: 1.3rem; 
                        line-height: 1.6;
                        opacity: 0.9;
                    }
                    .developer-info {
                        margin-top: 30px;
                        padding: 20px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 15px;
                        font-size: 0.9rem;
                        opacity: 0.8;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">
                        <i class="fas fa-server"></i>
                    </div>
                    <h1>خطأ في الخادم</h1>
                    <p>عذراً، حدث خطأ أثناء تحميل الصفحة</p>
                    <div class="developer-info">
                        <div>
                            <i class="fas fa-code"></i>
                            تصميم وتطوير: مصطفى طلعت للحلول البرمجية
                        </div>
                        <div style="margin-top: 5px;">
                            <i class="fas fa-phone"></i>
                            01116626164
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
};

function generateOrganizationHTML(organization) {
    const {
        name,
        description,
        address,
        phone,
        email,
        website,
        socialLinks,
        workingHours
    } = organization;

    // Generate contact info HTML
    const contactInfoHTML = generateContactInfoHTML(organization);
    
    // Generate social links HTML
    const socialLinksHTML = generateSocialLinksHTML(socialLinks);
    
    // Generate working hours HTML
    const workingHoursHTML = generateWorkingHoursHTML(workingHours);

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name || 'منشأتنا'}</title>
    <meta name="description" content="${description || 'مرحباً بكم في منشأتنا'}">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            padding: 20px;
            position: relative;
            overflow-x: hidden;
        }
        
        /* Animated background particles */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"><animate attributeName="cy" values="20;80;20" dur="3s" repeatCount="indefinite"/></circle><circle cx="50" cy="50" r="1.5" fill="rgba(255,255,255,0.15)"><animate attributeName="cy" values="50;10;50" dur="4s" repeatCount="indefinite"/></circle><circle cx="80" cy="30" r="2.5" fill="rgba(255,255,255,0.08)"><animate attributeName="cy" values="30;90;30" dur="5s" repeatCount="indefinite"/></circle></svg>') repeat;
            pointer-events: none;
            z-index: 0;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            padding: 50px;
            margin: 20px 0;
            box-shadow: 
                0 30px 60px rgba(0, 0, 0, 0.2),
                0 0 0 1px rgba(255, 255, 255, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            animation: fadeInUp 1s ease-out;
            position: relative;
            overflow: hidden;
        }
        
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #667eea);
            background-size: 200% 100%;
            animation: shimmer 3s ease-in-out infinite;
        }
        
        @keyframes shimmer {
            0%, 100% { background-position: 200% 0; }
            50% { background-position: -200% 0; }
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(40px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .header {
            text-align: center;
            margin-bottom: 60px;
            position: relative;
        }
        
        .header::after {
            content: '';
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 6px;
            background: linear-gradient(135deg, #667eea, #764ba2, #f093fb);
            border-radius: 3px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .header h1 {
            font-size: 4rem;
            font-weight: 800;
            color: #2d3748;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .header p {
            font-size: 1.4rem;
            color: #4a5568;
            max-width: 700px;
            margin: 0 auto;
            font-weight: 400;
            line-height: 1.8;
        }
        
        .section {
            margin: 50px 0;
            animation: slideInRight 0.8s ease-out;
        }
        
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .section-title {
            font-size: 2.2rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 35px;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .section-title .icon {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            color: white;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 30px;
            margin: 40px 0;
        }
        
        .info-item {
            display: flex;
            align-items: center;
            padding: 30px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 25px;
            border-right: 6px solid transparent;
            background-image: linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), 
                              linear-gradient(135deg, #667eea, #764ba2);
            background-origin: border-box;
            background-clip: content-box, border-box;
            transition: all 0.4s ease;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }
        
        .info-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
            transition: left 0.5s ease;
        }
        
        .info-item:hover::before {
            left: 100%;
        }
        
        .info-item:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        
        .info-item .icon {
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 25px;
            color: white;
            font-size: 1.8rem;
            flex-shrink: 0;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .info-item .content h3 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 1.3rem;
            font-weight: 700;
        }
        
        .info-item .content p {
            color: #4a5568;
            word-break: break-word;
            font-size: 1.1rem;
            line-height: 1.6;
        }
        
        .info-item .content a {
            color: #667eea;
            text-decoration: none;
            transition: color 0.3s ease;
            font-weight: 600;
        }
        
        .info-item .content a:hover {
            color: #764ba2;
        }
        
        .footer {
            text-align: center;
            margin-top: 60px;
            padding: 40px;
            color: #4a5568;
            font-size: 1rem;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 25px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .powered-by {
            margin-top: 20px;
            font-size: 0.9rem;
            color: #718096;
            line-height: 1.6;
        }
        
        .developer-info {
            margin-top: 25px;
            padding: 25px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 20px;
            font-weight: 600;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .developer-info .dev-name {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .developer-info .dev-contact {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 15px;
            }
            
            .card {
                padding: 30px;
                margin: 15px 0;
                border-radius: 25px;
            }
            
            .header h1 {
                font-size: 2.8rem;
            }
            
            .header p {
                font-size: 1.2rem;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .social-links {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .social-link {
                padding: 20px;
                font-size: 1rem;
            }
            
            .hours-grid {
                grid-template-columns: 1fr;
            }
            
            .section-title {
                font-size: 1.8rem;
            }
        }
        
        /* Loading animation */
        .loading {
            opacity: 0;
            animation: fadeIn 0.5s ease-in-out 0.2s forwards;
        }
        
        @keyframes fadeIn {
            to { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container loading">
        <div class="card">
            <div class="header">
                <h1>${name || 'منشأتنا'}</h1>
                ${description ? `<p>${description}</p>` : ''}
            </div>
            
            ${contactInfoHTML}
            
            ${socialLinksHTML}
            
            ${workingHoursHTML}
            
            <div class="footer">
                <p>تم إنشاء هذه الصفحة تلقائياً • ${new Date().toLocaleDateString('ar-EG')}</p>
                <div class="powered-by">
                    مدعوم بواسطة نظام Bomba لإدارة المنشآت
                </div>
                <div class="developer-info">
                    <div class="dev-name">
                        <i class="fas fa-code"></i>
                        تصميم وتطوير هذا النظام بواسطة مصطفى طلعت للحلول البرمجية
                    </div>
                    <div class="dev-contact">
                        <i class="fas fa-phone"></i>
                        01116626164
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Add smooth scrolling and enhanced interactions
        document.addEventListener('DOMContentLoaded', function() {
            // Smooth reveal animation
            const elements = document.querySelectorAll('.section, .info-item, .social-link');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            });
            
            elements.forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                observer.observe(el);
            });
        });
    </script>
</body>
</html>`;
}

function generateContactInfoHTML(organization) {
    const contactInfo = [];
    if (organization.address) contactInfo.push({ 
        icon: 'fas fa-map-marker-alt', 
        title: 'العنوان', 
        value: organization.address,
        color: '#e74c3c',
        bgColor: 'rgba(231, 76, 60, 0.1)'
    });
    if (organization.phone) contactInfo.push({ 
        icon: 'fas fa-phone', 
        title: 'الهاتف', 
        value: `<a href="tel:${organization.phone}" style="color: inherit; text-decoration: none;">${organization.phone}</a>`,
        color: '#27ae60',
        bgColor: 'rgba(39, 174, 96, 0.1)'
    });
    if (organization.email) contactInfo.push({ 
        icon: 'fas fa-envelope', 
        title: 'البريد الإلكتروني', 
        value: `<a href="mailto:${organization.email}" style="color: inherit; text-decoration: none;">${organization.email}</a>`,
        color: '#3498db',
        bgColor: 'rgba(52, 152, 219, 0.1)'
    });
    if (organization.website) contactInfo.push({ 
        icon: 'fas fa-globe', 
        title: 'الموقع الإلكتروني', 
        value: `<a href="${organization.website}" target="_blank" style="color: inherit; text-decoration: none; display: flex; align-items: center; gap: 8px;">${organization.website} <i class="fas fa-external-link-alt" style="font-size: 0.8rem; opacity: 0.7;"></i></a>`,
        color: '#9b59b6',
        bgColor: 'rgba(155, 89, 182, 0.1)'
    });

    if (contactInfo.length === 0) return '';

    return `
        <div class="section">
            <h2 class="section-title">
                <span class="icon"><i class="fas fa-address-card"></i></span>
                معلومات الاتصال
            </h2>
            <div class="contact-grid">
                ${contactInfo.map(info => `
                    <div class="contact-card" style="--card-color: ${info.color}; --card-bg: ${info.bgColor};">
                        <div class="contact-icon">
                            <i class="${info.icon}"></i>
                        </div>
                        <div class="contact-content">
                            <h3 class="contact-title">${info.title}</h3>
                            <p class="contact-value">${info.value}</p>
                        </div>
                        <div class="contact-decoration">
                            <i class="${info.icon}" style="opacity: 0.3;"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <style>
            .contact-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 25px;
                margin: 40px 0;
            }
            
            .contact-card {
                position: relative;
                display: flex;
                align-items: center;
                padding: 30px;
                background: linear-gradient(135deg, var(--card-bg), rgba(255, 255, 255, 0.95));
                border-radius: 20px;
                border: 2px solid transparent;
                background-clip: padding-box;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 4px 20px rgba(0, 0, 0, 0.08),
                    0 0 0 1px rgba(255, 255, 255, 0.5);
                overflow: hidden;
            }
            
            .contact-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, var(--card-color), transparent);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .contact-card:hover::before {
                opacity: 1;
            }
            
            .contact-card:hover {
                transform: translateY(-8px) scale(1.02);
                box-shadow: 
                    0 20px 40px rgba(0, 0, 0, 0.15),
                    0 0 0 1px var(--card-color);
                border-color: var(--card-color);
            }
            
            .contact-icon {
                width: 70px;
                height: 70px;
                background: linear-gradient(135deg, var(--card-color), rgba(0, 0, 0, 0.1));
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: 25px;
                color: white;
                font-size: 1.8rem;
                flex-shrink: 0;
                box-shadow: 
                    0 8px 25px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                position: relative;
                overflow: hidden;
            }
            
            .contact-icon::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                transform: rotate(45deg);
                transition: transform 0.6s ease;
            }
            
            .contact-card:hover .contact-icon::before {
                transform: rotate(45deg) translate(100%, 100%);
            }
            
            .contact-content {
                flex: 1;
                min-width: 0;
            }
            
            .contact-title {
                color: var(--card-color);
                margin-bottom: 8px;
                font-size: 1.1rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.9;
            }
            
            .contact-value {
                color: #2d3748;
                font-size: 1.1rem;
                line-height: 1.5;
                font-weight: 600;
                word-break: break-word;
                margin: 0;
            }
            
            .contact-value a {
                transition: all 0.3s ease;
                position: relative;
            }
            
            .contact-value a:hover {
                color: var(--card-color) !important;
                transform: translateX(-2px);
            }
            
            .contact-decoration {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--card-color);
                font-size: 1.2rem;
                transition: all 0.3s ease;
            }
            
            .contact-card:hover .contact-decoration {
                transform: scale(1.2) rotate(15deg);
            }
            
            @media (max-width: 768px) {
                .contact-grid {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                .contact-card {
                    padding: 25px;
                }
                
                .contact-icon {
                    width: 60px;
                    height: 60px;
                    margin-left: 20px;
                    font-size: 1.5rem;
                }
                
                .contact-title {
                    font-size: 1rem;
                }
                
                .contact-value {
                    font-size: 1rem;
                }
            }
        </style>
    `;
}

function generateSocialLinksHTML(socialLinks) {
    if (!socialLinks) return '';
    
    const links = [];
    const socialPlatforms = {
        facebook: { name: 'فيسبوك', icon: 'fab fa-facebook-f', color: '#1877f2', bgColor: 'rgba(24, 119, 242, 0.1)' },
        instagram: { name: 'إنستغرام', icon: 'fab fa-instagram', color: '#e4405f', bgColor: 'rgba(228, 64, 95, 0.1)' },
        twitter: { name: 'تويتر', icon: 'fab fa-twitter', color: '#1da1f2', bgColor: 'rgba(29, 161, 242, 0.1)' },
        linkedin: { name: 'لينكد إن', icon: 'fab fa-linkedin-in', color: '#0077b5', bgColor: 'rgba(0, 119, 181, 0.1)' },
        youtube: { name: 'يوتيوب', icon: 'fab fa-youtube', color: '#ff0000', bgColor: 'rgba(255, 0, 0, 0.1)' },
        tiktok: { name: 'تيك توك', icon: 'fab fa-tiktok', color: '#000000', bgColor: 'rgba(0, 0, 0, 0.1)' },
        whatsapp: { name: 'واتساب', icon: 'fab fa-whatsapp', color: '#25d366', bgColor: 'rgba(37, 211, 102, 0.1)' },
        telegram: { name: 'تليجرام', icon: 'fab fa-telegram-plane', color: '#0088cc', bgColor: 'rgba(0, 136, 204, 0.1)' },
        location: { name: 'الموقع على الخريطة', icon: 'fas fa-map-marked-alt', color: '#ff6b6b', bgColor: 'rgba(255, 107, 107, 0.1)' }
    };

    Object.entries(socialLinks).forEach(([platform, url]) => {
        if (url && url.trim()) {
            const platformInfo = socialPlatforms[platform];
            if (platformInfo) {
                // Handle WhatsApp phone numbers
                const href = platform === 'whatsapp' && !url.startsWith('http') 
                    ? `https://wa.me/${url.replace(/[^0-9]/g, '')}`
                    : url;
                
                links.push(`
                    <a href="${href}" target="_blank" class="social-card" style="--social-color: ${platformInfo.color}; --social-bg: ${platformInfo.bgColor};">
                        <div class="social-icon">
                            <i class="${platformInfo.icon}"></i>
                        </div>
                        <div class="social-content">
                            <span class="social-name">${platformInfo.name}</span>
                            <span class="social-action">تابعونا</span>
                        </div>
                        <div class="social-arrow">
                            <i class="fas fa-arrow-left"></i>
                        </div>
                    </a>
                `);
            }
        }
    });

    return links.length > 0 ? `
        <div class="section">
            <h2 class="section-title">
                <span class="icon"><i class="fas fa-share-alt"></i></span>
                تابعونا على
            </h2>
            <div class="social-grid">
                ${links.join('')}
            </div>
        </div>
        
        <style>
            .social-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 20px;
                margin: 40px 0;
            }
            
            .social-card {
                display: flex;
                align-items: center;
                padding: 25px;
                background: linear-gradient(135deg, var(--social-bg), rgba(255, 255, 255, 0.95));
                color: #2d3748;
                text-decoration: none;
                border-radius: 20px;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 600;
                font-size: 1.1rem;
                box-shadow: 
                    0 4px 20px rgba(0, 0, 0, 0.08),
                    0 0 0 1px rgba(255, 255, 255, 0.5);
                position: relative;
                overflow: hidden;
                border: 2px solid transparent;
            }
            
            .social-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                transition: left 0.6s ease;
            }
            
            .social-card:hover::before {
                left: 100%;
            }
            
            .social-card:hover {
                transform: translateY(-5px) scale(1.02);
                box-shadow: 
                    0 15px 35px rgba(0, 0, 0, 0.15),
                    0 0 0 2px var(--social-color);
                border-color: var(--social-color);
            }
            
            .social-icon {
                width: 60px;
                height: 60px;
                background: var(--social-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: 20px;
                color: white;
                font-size: 1.5rem;
                flex-shrink: 0;
                box-shadow: 
                    0 8px 25px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                transition: all 0.3s ease;
            }
            
            .social-card:hover .social-icon {
                transform: scale(1.1) rotate(5deg);
                box-shadow: 
                    0 12px 30px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
            }
            
            .social-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .social-name {
                font-size: 1.2rem;
                font-weight: 700;
                color: #2d3748;
            }
            
            .social-action {
                font-size: 0.9rem;
                color: var(--social-color);
                font-weight: 600;
                opacity: 0.8;
            }
            
            .social-arrow {
                color: var(--social-color);
                font-size: 1.2rem;
                transition: all 0.3s ease;
                opacity: 0.7;
            }
            
            .social-card:hover .social-arrow {
                transform: translateX(-5px);
                opacity: 1;
            }
            
            @media (max-width: 768px) {
                .social-grid {
                    grid-template-columns: 1fr;
                    gap: 15px;
                }
                
                .social-card {
                    padding: 20px;
                    font-size: 1rem;
                }
                
                .social-icon {
                    width: 50px;
                    height: 50px;
                    font-size: 1.3rem;
                    margin-left: 15px;
                }
                
                .social-name {
                    font-size: 1.1rem;
                }
            }
        </style>
    ` : '';
}

function generateWorkingHoursHTML(workingHours) {
    if (!workingHours) return '';
    
    // ترتيب الأيام بدءاً من السبت
    const dayOrder = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayNames = {
        saturday: 'السبت',
        sunday: 'الأحد',
        monday: 'الإثنين',
        tuesday: 'الثلاثاء',
        wednesday: 'الأربعاء',
        thursday: 'الخميس',
        friday: 'الجمعة'
    };

    const dayIcons = {
        saturday: 'fas fa-calendar-week',
        sunday: 'fas fa-sun',
        monday: 'fas fa-briefcase',
        tuesday: 'fas fa-calendar-day',
        wednesday: 'fas fa-calendar-check',
        thursday: 'fas fa-calendar-alt',
        friday: 'fas fa-mosque'
    };

    const hoursHTML = dayOrder.map((day) => {
        const hours = workingHours[day];
        if (!hours) return '';
        
        const dayName = dayNames[day] || day;
        const dayIcon = dayIcons[day] || 'fas fa-calendar';
        const isClosed = hours.closed;
        const timeText = isClosed ? 'مغلق' : `${hours.open || '09:00'} - ${hours.close || '22:00'}`;
        const statusColor = isClosed ? '#e74c3c' : '#27ae60';
        const statusBg = isClosed ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)';
        
        return `
            <div class="day-card ${isClosed ? 'closed' : 'open'}" style="--status-color: ${statusColor}; --status-bg: ${statusBg};">
                <div class="day-header">
                    <div class="day-info">
                        <div class="day-icon">
                            <i class="${dayIcon}"></i>
                        </div>
                        <div class="day-name">${dayName}</div>
                    </div>
                    <div class="day-status">
                        <i class="fas ${isClosed ? 'fa-times-circle' : 'fa-check-circle'}"></i>
                        <span>${isClosed ? 'مغلق' : 'مفتوح'}</span>
                    </div>
                </div>
                <div class="day-time">
                    <i class="fas fa-clock" style="margin-left: 8px; opacity: 0.7;"></i>
                    ${timeText}
                </div>
                <div class="day-decoration">
                    <i class="${dayIcon}" style="opacity: 0.2;"></i>
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    return `
        <div class="section">
            <h2 class="section-title">
                <span class="icon"><i class="fas fa-clock"></i></span>
                ساعات العمل
            </h2>
            <div class="hours-container">
                <div class="hours-header">
                    <h3>أوقات العمل الأسبوعية</h3>
                    <p>نحن في خدمتكم في الأوقات التالية</p>
                </div>
                <div class="hours-grid">
                    ${hoursHTML}
                </div>
            </div>
        </div>
        
        <style>
            .hours-container {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.8));
                border-radius: 25px;
                padding: 40px;
                margin: 40px 0;
                box-shadow: 
                    0 8px 25px rgba(0, 0, 0, 0.1),
                    0 0 0 1px rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.3);
                position: relative;
                overflow: hidden;
            }
            
            .hours-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);
                background-size: 200% 100%;
                animation: shimmer 3s ease-in-out infinite;
            }
            
            .hours-header {
                text-align: center;
                margin-bottom: 35px;
            }
            
            .hours-header h3 {
                color: #2d3748;
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 10px;
            }
            
            .hours-header p {
                color: #4a5568;
                font-size: 1.1rem;
                opacity: 0.8;
            }
            
            .hours-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
            }
            
            .day-card {
                background: linear-gradient(135deg, var(--status-bg), rgba(255, 255, 255, 0.9));
                border-radius: 18px;
                padding: 25px;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 
                    0 4px 15px rgba(0, 0, 0, 0.08),
                    0 0 0 1px rgba(255, 255, 255, 0.5);
                position: relative;
                overflow: hidden;
                border: 2px solid transparent;
            }
            
            .day-card::before {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                width: 4px;
                height: 100%;
                background: var(--status-color);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .day-card:hover::before {
                opacity: 1;
            }
            
            .day-card:hover {
                transform: translateY(-5px) scale(1.02);
                box-shadow: 
                    0 15px 30px rgba(0, 0, 0, 0.15),
                    0 0 0 2px var(--status-color);
                border-color: var(--status-color);
            }
            
            .day-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .day-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .day-icon {
                width: 40px;
                height: 40px;
                background: var(--status-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 1.1rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .day-name {
                font-weight: 700;
                color: #2d3748;
                font-size: 1.3rem;
            }
            
            .day-status {
                display: flex;
                align-items: center;
                gap: 6px;
                color: var(--status-color);
                font-size: 0.9rem;
                font-weight: 600;
                background: var(--status-bg);
                padding: 6px 12px;
                border-radius: 20px;
                border: 1px solid var(--status-color);
                opacity: 0.9;
            }
            
            .day-time {
                color: #2d3748;
                font-size: 1.2rem;
                font-weight: 600;
                text-align: center;
                padding: 15px;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .day-decoration {
                position: absolute;
                bottom: 10px;
                left: 10px;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--status-color);
                font-size: 1.2rem;
                transition: all 0.3s ease;
            }
            
            .day-card:hover .day-decoration {
                transform: scale(1.2) rotate(15deg);
            }
            
            .day-card.closed {
                opacity: 0.8;
            }
            
            @media (max-width: 768px) {
                .hours-container {
                    padding: 30px 20px;
                }
                
                .hours-grid {
                    grid-template-columns: 1fr;
                    gap: 15px;
                }
                
                .day-card {
                    padding: 20px;
                }
                
                .day-header {
                    flex-direction: column;
                    gap: 10px;
                    align-items: flex-start;
                }
                
                .day-info {
                    gap: 10px;
                }
                
                .day-icon {
                    width: 35px;
                    height: 35px;
                    font-size: 1rem;
                }
                
                .day-name {
                    font-size: 1.2rem;
                }
                
                .day-time {
                    font-size: 1.1rem;
                }
                
                .hours-header h3 {
                    font-size: 1.6rem;
                }
            }
        </style>
    `;
}