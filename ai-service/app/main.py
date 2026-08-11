# ai-service/app/main.py (Full updated version)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import os
import re
import random
from datetime import datetime
from pymongo import MongoClient
from difflib import get_close_matches

app = FastAPI()

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to MongoDB
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGODB_URI)
db = client.get_database("intellipos")

class ChatRequest(BaseModel):
    message: str
    userId: str
    userEmail: str

class ChatResponse(BaseModel):
    success: bool
    reply: Optional[str] = None
    error: Optional[str] = None

# Store pending actions and conversation context per user
pending_actions = {}
conversation_context = {}

# ============ SPELLING CORRECTION ============
def correct_text(text: str) -> str:
    corrections = {
        'cusmer': 'customer', 'cusmers': 'customers',
        'custmer': 'customer', 'custmers': 'customers',
        'prodct': 'product', 'prodcts': 'products',
        'produt': 'product', 'produts': 'products',
        'vendr': 'vendor', 'vendrs': 'vendors',
        'vendore': 'vendor', 'vendores': 'vendors',
        'revnue': 'revenue', 'revanue': 'revenue',
        'supplr': 'supplier', 'supplrs': 'suppliers',
        'invetory': 'inventory', 'stok': 'stock',
        'prics': 'price', 'quantty': 'quantity',
        'countt': 'count', 'totaly': 'total',
        'howw': 'how', 'mani': 'many', 'maney': 'many',
        'whot': 'what', 'wat': 'what', 'wht': 'what',
        'dose': 'does', 'doe': 'does', 'nicee': 'nice',
        'yeah': 'yes', 'yep': 'yes', 'yup': 'yes',
        'nope': 'no', 'nah': 'no',
        'vendo': 'vendor', 'vend': 'vendor',
        'sup': 'supplier', 'custo': 'customer',
        'cust': 'customer', 'emp': 'employee',
        'employe': 'employee', 'emplo': 'employee',
        'staff': 'employee', 'team': 'employee',
        'worker': 'employee', 'workers': 'employees',
        'cat': 'category', 'categ': 'category',
        'categori': 'category', 'cate': 'category',
    }
    words = text.split()
    corrected_words = []
    for word in words:
        clean_word = re.sub(r'[^\w\s]', '', word)
        if clean_word.lower() in corrections:
            corrected = corrections[clean_word.lower()]
            if word[0].isupper():
                corrected = corrected.capitalize()
            corrected_words.append(corrected)
        else:
            corrected_words.append(word)
    return ' '.join(corrected_words)

# ============ DATABASE FUNCTIONS ============
def get_products_count():
    return db.products.count_documents({"isDeleted": False})

def get_customers_count():
    return db.customers.count_documents({})

def get_vendors_count():
    return db.vendors.count_documents({})

def get_employees_count():
    return db.employees.count_documents({})

def get_categories_count():
    return db.categories.count_documents({"isDeleted": False})

def get_low_stock_products():
    return list(db.products.find({
        "isDeleted": False,
        "$expr": {"$lte": ["$stock", "$minStock"]}
    }).limit(10))

def get_products():
    return list(db.products.find({"isDeleted": False}).limit(10))

def get_customers():
    return list(db.customers.find({}).limit(10))

def get_vendors():
    return list(db.vendors.find({}).limit(10))

def get_employees():
    return list(db.employees.find({}).limit(10))

def get_categories():
    return list(db.categories.find({"isDeleted": False}).limit(10))

def get_revenue():
    pipeline = [
        {"$match": {"paymentStatus": "paid", "isDeleted": False}},
        {"$group": {"_id": None, "total": {"$sum": "$grandTotal"}}}
    ]
    result = list(db.orders.aggregate(pipeline))
    return result[0]['total'] if result else 0

def get_orders_count():
    return db.orders.count_documents({"isDeleted": False})

# ============ PRODUCT OPERATIONS ============
def add_product(data):
    count = db.products.count_documents({})
    data['sku'] = f"PROD-{datetime.now().strftime('%Y%m%d')}-{count + 1:04d}"
    data.setdefault('category', 'Uncategorized')
    data.setdefault('description', 'Added via AI Assistant')
    data.setdefault('purchasePrice', data.get('sellingPrice', 0) * 0.6)
    data.setdefault('discount', 0)
    data.setdefault('tax', 5)
    data.setdefault('unit', 'Piece')
    data.setdefault('tags', ['ai-generated'])
    data.setdefault('status', 'active')
    data.setdefault('minStock', 5)
    data.setdefault('isDeleted', False)
    data['createdAt'] = datetime.now()
    data['updatedAt'] = datetime.now()
    
    result = db.products.insert_one(data)
    return db.products.find_one({"_id": result.inserted_id})

def update_product_stock(product_name: str, quantity: int) -> str:
    """Update stock for an existing product"""
    # Try exact match first
    product = db.products.find_one({
        "name": {"$regex": f"^{product_name}$", "$options": "i"},
        "isDeleted": False
    })
    
    if not product:
        # Try partial match
        product = db.products.find_one({
            "name": {"$regex": product_name, "$options": "i"},
            "isDeleted": False
        })
    
    if not product:
        return f"❌ Product '{product_name}' not found. Please check the name or add it as a new product."
    
    # Update stock
    new_stock = product['stock'] + quantity
    db.products.update_one(
        {"_id": product['_id']},
        {"$set": {"stock": new_stock, "updatedAt": datetime.now()}}
    )
    
    direction = "added" if quantity > 0 else "removed"
    return f"✅ Stock updated for **'{product['name']}'**!\n📦 Previous stock: {product['stock']}\n📦 New stock: {new_stock}\n📊 {quantity} units {direction}"

def update_product_field(product_name: str, field: str, value) -> str:
    """Update any field of a product"""
    product = db.products.find_one({
        "name": {"$regex": f"^{product_name}$", "$options": "i"},
        "isDeleted": False
    })
    
    if not product:
        return f"❌ Product '{product_name}' not found."
    
    # Update the field
    update_data = {field: value, "updatedAt": datetime.now()}
    db.products.update_one(
        {"_id": product['_id']},
        {"$set": update_data}
    )
    
    field_names = {
        'stock': 'Stock',
        'sellingPrice': 'Price',
        'category': 'Category',
        'description': 'Description',
        'minStock': 'Min Stock'
    }
    
    return f"✅ Updated **'{product['name']}'** {field_names.get(field, field)} to **{value}**!"

# ============ OTHER OPERATIONS ============
def add_vendor(data):
    existing = db.vendors.find_one({"email": data.get('email')})
    if existing:
        return None, "Vendor with this email already exists"
    
    data.setdefault('status', 'active')
    data.setdefault('contactName', data.get('name'))
    data['createdAt'] = datetime.now()
    data['updatedAt'] = datetime.now()
    
    result = db.vendors.insert_one(data)
    return db.vendors.find_one({"_id": result.inserted_id}), None

def add_customer(data):
    data['createdAt'] = datetime.now()
    data['updatedAt'] = datetime.now()
    result = db.customers.insert_one(data)
    return db.customers.find_one({"_id": result.inserted_id})

def add_employee(data):
    existing = db.employees.find_one({"email": data.get('email')})
    if existing:
        return None, "Employee with this email already exists"
    
    data.setdefault('status', 'active')
    data.setdefault('department', 'General')
    data.setdefault('salary', 0)
    data['createdAt'] = datetime.now()
    data['updatedAt'] = datetime.now()
    
    result = db.employees.insert_one(data)
    return db.employees.find_one({"_id": result.inserted_id}), None

def add_category(data):
    existing = db.categories.find_one({
        "name": {"$regex": f"^{data.get('name')}$", "$options": "i"},
        "isDeleted": False
    })
    if existing:
        return None, "Category with this name already exists"
    
    data.setdefault('status', 'active')
    data.setdefault('description', '')
    data.setdefault('isDeleted', False)
    data['createdAt'] = datetime.now()
    data['updatedAt'] = datetime.now()
    
    result = db.categories.insert_one(data)
    return db.categories.find_one({"_id": result.inserted_id}), None

# ============ NATURAL LANGUAGE PARSER ============
def parse_natural_input(text: str) -> dict:
    """Parse natural language input into field:value pairs"""
    result = {}
    text = text.strip()
    
    # Try field: value format
    if ':' in text:
        parts = text.split(',')
        for part in parts:
            part = part.strip()
            if ':' in part:
                key, value = part.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                result[key] = value
    
    # Detect email
    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    if email_match and 'email' not in result:
        result['email'] = email_match.group(0)
        text = text.replace(email_match.group(0), '')
    
    # Detect phone number
    phone_match = re.search(r'(\+?[\d\s-]{7,})', text)
    if phone_match and 'phone' not in result:
        result['phone'] = phone_match.group(0).strip()
        text = text.replace(phone_match.group(0), '')
    
    # Detect quantity for stock updates
    qty_match = re.search(r'(\d+)\s*(?:items?|units?|pieces?)', text, re.I)
    if qty_match and 'quantity' not in result:
        result['quantity'] = int(qty_match.group(1))
    
    # Detect price
    price_match = re.search(r'price:?\s*(\d+)', text, re.I)
    if price_match and 'price' not in result:
        result['price'] = price_match.group(1)
    
    # Detect stock
    stock_match = re.search(r'stock:?\s*(\d+)', text, re.I)
    if stock_match and 'stock' not in result:
        result['stock'] = stock_match.group(1)
    
    # Detect salary
    salary_match = re.search(r'salary:?\s*(\d+)', text, re.I)
    if salary_match and 'salary' not in result:
        result['salary'] = salary_match.group(1)
    
    # Detect role
    role_match = re.search(r'role:?\s*([^,\s]+)', text, re.I)
    if role_match and 'role' not in result:
        result['role'] = role_match.group(1)
    
    # Detect department
    dept_match = re.search(r'department:?\s*([^,\s]+)', text, re.I)
    if dept_match and 'department' not in result:
        result['department'] = dept_match.group(1)
    
    # Detect name (remaining text) - but only if it's not an update command
    if 'name' not in result and not any(w in text for w in ['add', 'new', 'update', 'change']):
        name_parts = [w for w in text.split() if w and w not in ['employee', 'employ', 'staff', 'vendor', 'customer', 'product', 'category']]
        if name_parts:
            result['name'] = ' '.join(name_parts)
    
    return result

# ============ FIELD DEFINITIONS ============
FIELD_DEFINITIONS = {
    'vendor': {
        'required': ['name', 'email'],
        'optional': ['phone', 'contactName', 'address', 'gstin', 'notes'],
        'display': {
            'name': 'Name',
            'email': 'Email',
            'phone': 'Phone',
            'contactName': 'Contact Person',
            'address': 'Address',
            'gstin': 'GSTIN/Tax ID',
            'notes': 'Notes'
        }
    },
    'customer': {
        'required': ['name', 'email'],
        'optional': ['phone', 'address'],
        'display': {
            'name': 'Name',
            'email': 'Email',
            'phone': 'Phone',
            'address': 'Address'
        }
    },
    'product': {
        'required': ['name', 'price', 'stock'],
        'optional': ['category', 'description', 'unit'],
        'display': {
            'name': 'Name',
            'price': 'Price',
            'stock': 'Stock',
            'category': 'Category',
            'description': 'Description',
            'unit': 'Unit'
        }
    },
    'employee': {
        'required': ['name', 'email'],
        'optional': ['phone', 'role', 'department', 'salary'],
        'display': {
            'name': 'Name',
            'email': 'Email',
            'phone': 'Phone',
            'role': 'Role/Position',
            'department': 'Department',
            'salary': 'Salary (annual)'
        }
    },
    'category': {
        'required': ['name'],
        'optional': ['description'],
        'display': {
            'name': 'Category Name',
            'description': 'Description'
        }
    }
}

def get_fields_message(entity_type: str, collected: dict) -> str:
    """Generate a nice message showing required and optional fields"""
    fields = FIELD_DEFINITIONS.get(entity_type, {})
    required = fields.get('required', [])
    optional = fields.get('optional', [])
    display = fields.get('display', {})
    
    message = f"📝 **Add {entity_type.capitalize()}**\n\n"
    
    # Required fields (bold with ⭐)
    message += "**Required:**\n"
    for field in required:
        if field in collected:
            message += f"  ✅ {display.get(field, field)}: {collected[field]}\n"
        else:
            message += f"  ⭐ **{display.get(field, field)}**: (required)\n"
    
    # Optional fields
    if optional:
        message += "\n**Optional:**\n"
        for field in optional[:4]:
            if field in collected:
                message += f"  ✅ {display.get(field, field)}: {collected[field]}\n"
            else:
                message += f"  • {display.get(field, field)}: (optional)\n"
    
    message += "\n💡 **Tips:**\n"
    message += "• Provide fields as: `field: value`\n"
    message += "• Or type naturally: `name: John, email: john@email.com`\n"
    message += "• Optional fields can be skipped\n"
    
    return message

# ============ CONVERSATIONAL RESPONSES ============
conversational_responses = {
    'nice': [
        "I'm glad you like it! 😊 Is there anything else you'd like to know?",
        "Thank you! 😊 What else can I help you with?",
        "Awesome! 🎉 Let me know if you need anything else!"
    ],
    'thanks': [
        "You're welcome! 😊 Happy to help!",
        "Anytime! 🎉 Let me know if you need anything else.",
        "My pleasure! 💪 What's next?"
    ],
    'good': [
        "Great to hear! 😊 How can I assist you further?",
        "Wonderful! 🎉 Anything else I can do for you?",
        "Awesome! 💪 What would you like to explore next?"
    ],
    'bye': [
        "Goodbye! 👋 Have a great day! Come back anytime!",
        "See you later! 🎉 Take care!",
        "Bye for now! 👋 Wishing you success!"
    ],
    'yes': [
        "Great! 😊 What would you like to do next?",
        "Awesome! 🎉 How can I help?",
        "Wonderful! 💪 What's on your mind?"
    ],
    'no': [
        "Okay! 😊 Let me know what you'd like to do instead.",
        "No problem! 🎉 What would you prefer?",
        "Alright! 💪 How can I assist?"
    ],
    'default': [
        "I'm here to help! 😊 What would you like to know about your business?",
        "How can I assist you today? 💪 I can help with products, customers, vendors, employees, and more!",
        "I'm ready to help! 🎉 Just ask me about your business data."
    ],
    'greeting': [
        "Hello! 👋 How can I help you today?",
        "Hi there! 😊 What can I do for you?",
        "Hey! 🎉 How can I assist you with your business?"
    ]
}

def get_conversational_reply(message: str, context: dict) -> Optional[str]:
    text = message.lower().strip()
    
    if text in ['nice', 'cool', 'great', 'awesome', 'wow', 'amazing']:
        return random.choice(conversational_responses['nice'])
    if text in ['thanks', 'thank you', 'thx', 'ty']:
        return random.choice(conversational_responses['thanks'])
    if text in ['good', 'fine', 'okay', 'ok']:
        return random.choice(conversational_responses['good'])
    if text in ['bye', 'goodbye', 'see you', 'later']:
        return random.choice(conversational_responses['bye'])
    if text in ['yes', 'yeah', 'yep', 'sure']:
        return random.choice(conversational_responses['yes'])
    if text in ['no', 'nope', 'nah']:
        return random.choice(conversational_responses['no'])
    if any(g in text for g in ['hello', 'hi', 'hey']):
        return random.choice(conversational_responses['greeting'])
    return None

# ============ MAIN PROCESSING ============
def process_message(user_id: str, message: str) -> str:
    corrected_text = correct_text(message)
    text = corrected_text.lower().strip()
    
    if user_id not in conversation_context:
        conversation_context[user_id] = {
            'last_topic': None,
            'interaction_count': 0,
            'last_message': ''
        }
    context = conversation_context[user_id]
    context['interaction_count'] += 1
    
    # Check for casual responses
    casual_reply = get_conversational_reply(text, context)
    if casual_reply:
        return casual_reply
    
    # Check pending action
    if user_id in pending_actions:
        return handle_pending_action(user_id, message)
    
    # Detect intent
    product_words = ['product', 'prodct', 'produt', 'prod', 'inventory', 'invetory', 'stock', 'stok', 'item']
    customer_words = ['customer', 'custmer', 'cusmer', 'client', 'clent', 'buyer']
    vendor_words = ['vendor', 'vendr', 'vendore', 'vend', 'supplier', 'supplr', 'provider']
    employee_words = ['employee', 'employe', 'emplo', 'staff', 'team', 'worker', 'hire', 'personnel']
    category_words = ['category', 'categ', 'categori', 'cat', 'cate']
    revenue_words = ['revenue', 'revnue', 'revanue', 'sales', 'earning', 'profit', 'income', 'money']
    update_words = ['update', 'change', 'add to', 'increase', 'decrease', 'reduce', 'modify', 'edit']
    
    has_product = any(p in text for p in product_words)
    has_customer = any(c in text for c in customer_words)
    has_vendor = any(v in text for v in vendor_words)
    has_employee = any(e in text for e in employee_words)
    has_category = any(c in text for c in category_words)
    has_revenue = any(r in text for r in revenue_words)
    has_update = any(u in text for u in update_words)
    
    # ============ INVENTORY UPDATE ============
    if has_update and has_product:
        # Check for "add X to stock" pattern
        stock_match = re.search(r'add\s+(\d+)\s+(?:to\s+)?stock', text, re.I)
        if stock_match:
            quantity = int(stock_match.group(1))
            # Find product name
            # Remove "add X to stock" and "in" from the message
            remaining = re.sub(r'add\s+\d+\s+(?:to\s+)?stock', '', text, flags=re.I)
            remaining = re.sub(r'in\s+', '', remaining, flags=re.I)
            product_name = remaining.strip()
            
            if product_name:
                return update_product_stock(product_name, quantity)
        
        # Check for "update product [name] field: value"
        product_match = re.search(r'(?:update|change)\s+(?:product\s+)?([^,]+?)(?:\s+(?:to|:|set)\s+|\s*,\s*)([^:]+?):\s*(.+)', text, re.I)
        if product_match:
            product_name = product_match.group(1).strip()
            field = product_match.group(2).strip().lower()
            value = product_match.group(3).strip()
            
            field_map = {
                'price': 'sellingPrice',
                'stock': 'stock',
                'category': 'category',
                'description': 'description',
                'min stock': 'minStock',
                'minstock': 'minStock'
            }
            mapped_field = field_map.get(field, field)
            
            if mapped_field in ['sellingPrice', 'stock', 'minStock']:
                value = float(value) if '.' in value else int(value)
            
            return update_product_field(product_name, mapped_field, value)
    
    # ============ CATEGORY QUERIES ============
    if has_category:
        if any(c in text for c in ['how many', 'total', 'count', 'number of']):
            count = get_categories_count()
            return f"📁 You have **{count}** categories."
        if any(s in text for s in ['show', 'list', 'display', 'view', 'see']):
            categories = get_categories()
            if not categories:
                return "📁 No categories found. Would you like to add one? 🤔"
            reply = "📁 **Categories:**\n\n"
            for c in categories[:10]:
                reply += f"• {c.get('name', 'Unknown')} - {c.get('description', 'No description')}\n"
            return reply
        if 'add' in text or 'new' in text:
            parsed = parse_natural_input(text)
            if 'name' in parsed:
                category_data = {
                    'name': parsed['name'],
                    'description': parsed.get('description', '')
                }
                category, error = add_category(category_data)
                if error:
                    return f"❌ {error}"
                return f"✅ Category **'{category['name']}'** added successfully!\n📝 {category.get('description', 'No description')}"
            else:
                pending_actions[user_id] = {
                    'type': 'add_category',
                    'collected': parsed,
                    'required': ['name']
                }
                return get_fields_message('category', parsed)
    
    # ============ PRODUCT QUERIES ============
    if has_product and not has_update:
        if any(c in text for c in ['how many', 'total', 'count', 'number of']):
            count = get_products_count()
            return f"📦 You have **{count}** products in your inventory. 🎯"
        if any(l in text for l in ['low stock', 'restock', 'out of stock']):
            low = get_low_stock_products()
            if not low:
                return "🎉 All products are well stocked! You're doing great! 💪"
            reply = "⚠️ **Low stock alerts:**\n\n"
            for p in low[:5]:
                reply += f"• {p['name']} - only {p['stock']} left (min: {p['minStock']})\n"
            return reply
        if any(s in text for s in ['show', 'list', 'display', 'view', 'see']):
            products = get_products()
            if not products:
                return "📦 No products found in inventory. Would you like to add some? 🛒"
            reply = "📦 **Products in inventory:**\n\n"
            for p in products[:10]:
                reply += f"• {p['name']} - ${p.get('sellingPrice', 0)} - {p.get('stock', 0)} in stock\n"
            return reply
        if 'add' in text:
            parsed = parse_natural_input(text)
            if 'name' in parsed and 'price' in parsed and 'stock' in parsed:
                product_data = {
                    'name': parsed['name'],
                    'sellingPrice': float(parsed['price']),
                    'stock': int(parsed['stock'])
                }
                product = add_product(product_data)
                return f"✅ Product **'{product['name']}'** added!\n📊 Price: ${product['sellingPrice']}\n📦 Stock: {product['stock']}\n🔑 SKU: {product['sku']}\n\nWould you like to add another product? 🤔"
            else:
                pending_actions[user_id] = {
                    'type': 'add_product',
                    'collected': parsed,
                    'required': ['name', 'price', 'stock']
                }
                return get_fields_message('product', parsed)
    
    # ============ CUSTOMER QUERIES ============
    if has_customer:
        if any(c in text for c in ['how many', 'total', 'count', 'number of']):
            count = get_customers_count()
            return f"👥 You have **{count}** customers in your database. 📊"
        if any(s in text for s in ['show', 'list', 'display', 'view', 'see']):
            customers = get_customers()
            if not customers:
                return "👥 No customers found. Would you like to add some? 🤔"
            reply = "👥 **Customers:**\n\n"
            for c in customers[:10]:
                reply += f"• {c.get('name', 'Unknown')} - {c.get('email', 'No email')}\n"
            return reply
        if 'add' in text or 'new' in text:
            parsed = parse_natural_input(text)
            if 'name' in parsed and 'email' in parsed:
                customer_data = {
                    'name': parsed['name'],
                    'email': parsed['email'],
                    'phone': parsed.get('phone', '')
                }
                customer = add_customer(customer_data)
                return f"✅ Customer **'{customer['name']}'** added successfully!\n📧 Email: {customer['email']}\n📱 Phone: {customer.get('phone', 'No phone')}"
            else:
                pending_actions[user_id] = {
                    'type': 'add_customer',
                    'collected': parsed,
                    'required': ['name', 'email']
                }
                return get_fields_message('customer', parsed)
    
    # ============ VENDOR QUERIES ============
    if has_vendor:
        if any(c in text for c in ['how many', 'total', 'count', 'number of']):
            count = get_vendors_count()
            return f"🏪 You have **{count}** vendors in your database. 📊"
        if any(s in text for s in ['show', 'list', 'display', 'view', 'see']):
            vendors = get_vendors()
            if not vendors:
                return "🏪 No vendors found. Would you like to add some? 🤔"
            reply = "🏪 **Vendors:**\n\n"
            for v in vendors[:10]:
                reply += f"• {v.get('name', 'Unknown')} - {v.get('email', 'No email')}\n"
            return reply
        if 'add' in text or 'new' in text:
            parsed = parse_natural_input(text)
            if 'name' in parsed and 'email' in parsed:
                vendor_data = {
                    'name': parsed['name'],
                    'email': parsed['email'],
                    'phone': parsed.get('phone', ''),
                    'contactName': parsed.get('name', '')
                }
                vendor, error = add_vendor(vendor_data)
                if error:
                    return f"❌ {error}"
                return f"✅ Vendor **'{vendor['name']}'** added successfully!\n📧 Email: {vendor['email']}\n📱 Phone: {vendor.get('phone', 'No phone')}"
            else:
                pending_actions[user_id] = {
                    'type': 'add_vendor',
                    'collected': parsed,
                    'required': ['name', 'email']
                }
                return get_fields_message('vendor', parsed)
    
    # ============ EMPLOYEE QUERIES ============
    if has_employee:
        if any(c in text for c in ['how many', 'total', 'count', 'number of']):
            count = get_employees_count()
            return f"👔 You have **{count}** employees in your team. 💪"
        if any(s in text for s in ['show', 'list', 'display', 'view', 'see']):
            employees = get_employees()
            if not employees:
                return "👔 No employees found. Would you like to hire someone? 🤔"
            reply = "👔 **Employees:**\n\n"
            for e in employees[:10]:
                reply += f"• {e.get('name', 'Unknown')} - {e.get('role', 'No role')} - {e.get('department', 'No dept')}\n"
            return reply
        if 'add' in text or 'new' in text or 'hire' in text:
            parsed = parse_natural_input(text)
            if 'name' in parsed and 'email' in parsed:
                employee_data = {
                    'name': parsed['name'],
                    'email': parsed['email'],
                    'phone': parsed.get('phone', ''),
                    'role': parsed.get('role', 'Employee'),
                    'department': parsed.get('department', 'General'),
                    'salary': float(parsed.get('salary', 0)) if parsed.get('salary') else 0                }
                employee, error = add_employee(employee_data)
                if error:
                    return f"❌ {error}"
                return f"✅ Employee **'{employee['name']}'** added!\n📧 Email: {employee['email']}\n📱 Phone: {employee.get('phone', 'No phone')}\n👔 Role: {employee.get('role', 'Employee')}\n🏢 Dept: {employee.get('department', 'General')}\n💰 Salary: ${employee.get('salary', 0):,}/year\n\n🎉 Welcome to the team!"
            else:
                pending_actions[user_id] = {
                    'type': 'add_employee',
                    'collected': parsed,
                    'required': ['name', 'email']
                }
                return get_fields_message('employee', parsed)
    
    # ============ REVENUE ============
    if has_revenue:
        revenue = get_revenue()
        orders_count = get_orders_count()
        return f"💰 **Revenue:** ${revenue:,.2f}\n📊 **Total Orders:** {orders_count}"
    
    # ============ DEFAULT ============
    if len(text.split()) < 3:
        return random.choice(conversational_responses['default'])
    
    return "I'm not sure how to help with that. 🤔 Try asking about:\n• Products 📦\n• Customers 👥\n• Vendors 🏪\n• Employees 👔\n• Categories 📁\n• Revenue 💰\n\nOr just chat with me naturally! 💬"

def handle_pending_action(user_id: str, message: str) -> str:
    action = pending_actions.get(user_id)
    if not action:
        return "I'm not sure what you're trying to do. Let's start over! 😊"
    
    # Parse the message
    parsed = parse_natural_input(message)
    
    # Update collected fields
    for key, value in parsed.items():
        if key in action['required'] or key in ['name', 'email', 'phone', 'role', 'department', 'salary', 'contactName', 'address', 'gstin', 'notes', 'category', 'description', 'unit', 'price', 'stock']:
            action['collected'][key] = value
    
    # Check if we have all required fields
    missing = [f for f in action['required'] if f not in action['collected']]
    
    if missing:
        entity_type = action['type'].replace('add_', '')
        return get_fields_message(entity_type, action['collected'])
    
    # Execute the action
    if action['type'] == 'add_product':
        product_data = {
            'name': action['collected'].get('name', 'Product'),
            'sellingPrice': float(action['collected'].get('price', 0)),
            'stock': int(action['collected'].get('stock', 0))
        }
        product = add_product(product_data)
        del pending_actions[user_id]
        return f"✅ Product **'{product['name']}'** added!\n📊 Price: ${product['sellingPrice']}\n📦 Stock: {product['stock']}\n🔑 SKU: {product['sku']}\n\n🎉 All done! Anything else?"
    
    elif action['type'] == 'add_customer':
        customer_data = {
            'name': action['collected'].get('name', 'Customer'),
            'email': action['collected'].get('email', ''),
            'phone': action['collected'].get('phone', '')
        }
        customer = add_customer(customer_data)
        del pending_actions[user_id]
        return f"✅ Customer **'{customer['name']}'** added!\n📧 Email: {customer['email']}\n📱 Phone: {customer.get('phone', 'No phone')}\n\n🎉 All done! Anything else?"
    
    elif action['type'] == 'add_vendor':
        vendor_data = {
            'name': action['collected'].get('name', 'Vendor'),
            'email': action['collected'].get('email', ''),
            'phone': action['collected'].get('phone', ''),
            'contactName': action['collected'].get('contactName', action['collected'].get('name', '')),
            'address': action['collected'].get('address', ''),
            'gstin': action['collected'].get('gstin', ''),
            'notes': action['collected'].get('notes', '')
        }
        vendor, error = add_vendor(vendor_data)
        del pending_actions[user_id]
        if error:
            return f"❌ {error}"
        return f"✅ Vendor **'{vendor['name']}'** added!\n📧 Email: {vendor['email']}\n📱 Phone: {vendor.get('phone', 'No phone')}\n\n🎉 All done! Anything else?"
    
    elif action['type'] == 'add_employee':
        employee_data = {
            'name': action['collected'].get('name', 'Employee'),
            'email': action['collected'].get('email', ''),
            'phone': action['collected'].get('phone', ''),
            'role': action['collected'].get('role', 'Employee'),
            'department': action['collected'].get('department', 'General'),
            'salary': float(action['collected'].get('salary', 0)) if action['collected'].get('salary') else 0
        }
        employee, error = add_employee(employee_data)
        del pending_actions[user_id]
        if error:
            return f"❌ {error}"
        return f"✅ Employee **'{employee['name']}'** added!\n📧 Email: {employee['email']}\n📱 Phone: {employee.get('phone', 'No phone')}\n👔 Role: {employee.get('role', 'Employee')}\n🏢 Dept: {employee.get('department', 'General')}\n💰 Salary: ${employee.get('salary', 0):,}/year\n\n🎉 Welcome to the team! Anything else?"
    
    elif action['type'] == 'add_category':
        category_data = {
            'name': action['collected'].get('name', 'Category'),
            'description': action['collected'].get('description', '')
        }
        category, error = add_category(category_data)
        del pending_actions[user_id]
        if error:
            return f"❌ {error}"
        return f"✅ Category **'{category['name']}'** added!\n📝 {category.get('description', 'No description')}\n\n🎉 All done! Anything else?"
    
    del pending_actions[user_id]
    return "✅ Action completed! 🎉 Anything else I can help with?"

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        reply = process_message(request.userId, request.message)
        return ChatResponse(success=True, reply=reply)
    except Exception as e:
        return ChatResponse(success=False, error=str(e))

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "mongodb": "connected" if db.orders is not None else "disconnected"
    }

if __name__ == "__main__":
    port = int(os.environ.get("AI_PORT", 8000))
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        reload=True
    )