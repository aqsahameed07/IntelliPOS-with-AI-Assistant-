# ai-service/app/ai_agent.py
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
from app.database import db

class AIAgent:
    def __init__(self):
        self.context = {}
        self.pending_actions = {}  # Track multi-step actions
        self.required_fields = {
            'vendor': ['name', 'email', 'phone'],
            'customer': ['name', 'email', 'phone'],
            'product': ['name', 'sellingPrice', 'stock']
        }
    
    def process_query(self, user_id: str, message: str) -> Dict[str, Any]:
        """Process user query and return response with action"""
        message = message.strip()
        
        # Check if we're in the middle of a multi-step action
        if user_id in self.pending_actions:
            result = self._handle_pending_action(user_id, message)
            if result:
                return result
        
        # Process the query
        response = {
            'reply': '',
            'action': None,
            'data': None,
            'needs_follow_up': False
        }
        
        # ============ GREETINGS ============
        if re.search(r'\b(hello|hi|hey|good morning|good afternoon)\b', message, re.I):
            response['reply'] = "Hello! 👋 How can I help you today? I can:\n• 📊 Check business stats\n• 📦 Manage products\n• 👥 Manage customers\n• 🏪 Manage vendors\n• 💰 Check revenue\n\nWhat would you like to do?"
            return response
        
        # ============ HELP ============
        if re.search(r'\b(help|what can you do|capabilities)\b', message, re.I):
            response['reply'] = """🤖 I can help with:

📊 **Business Stats**
• "How many products do I have?"
• "Show me customers"
• "What's my revenue?"

📦 **Products**
• "Add product: Laptop, price: 1000, stock: 10"
• "Low stock products"
• "Add 5 units to product XYZ"

👥 **Customers**
• "Add customer: John, email: john@email.com, phone: 1234567890"
• "Show me top customers"

🏪 **Vendors**
• "Add vendor: Tech Supplies, email: tech@supplies.com"
• "Show me vendors"

💰 **Revenue & Sales**
• "What's my total revenue?"
• "How many orders?"

Just tell me what you want to do!"""
            return response
        
        # ============ PRODUCTS ============
        if re.search(r'\b(product|products|inventory|stock)\b', message, re.I):
            # Count products
            if re.search(r'\b(how many|total|count|number of)\b.*\bproduct', message, re.I):
                count = db.get_products_count()
                response['reply'] = f"📦 You have **{count}** products in your inventory."
                return response
            
            # Low stock
            if re.search(r'\b(low stock|restock|out of stock)\b', message, re.I):
                low_stock = db.get_low_stock_products()
                if not low_stock:
                    response['reply'] = "🎉 All products are well stocked!"
                    return response
                
                reply = "⚠️ **Low stock alerts:**\n\n"
                for p in low_stock[:10]:
                    reply += f"• {p['name']} - only {p['stock']} left (min: {p['minStock']})\n"
                if len(low_stock) > 10:
                    reply += f"\n... and {len(low_stock) - 10} more products need restocking."
                response['reply'] = reply
                return response
            
            # Show products
            if re.search(r'\b(show|list|display|view)\b.*\bproduct', message, re.I):
                products = db.get_products(limit=10)
                if not products:
                    response['reply'] = "No products found."
                    return response
                
                reply = "📦 **Products:**\n\n"
                for p in products:
                    reply += f"• {p['name']} - ${p['sellingPrice']} - {p['stock']} in stock\n"
                if len(products) >= 10:
                    reply += "\n... showing first 10 products."
                response['reply'] = reply
                return response
            
            # Add product
            add_match = re.search(r'add product:?\s*(.+?)(?:,\s*price:?\s*(\d+))?(?:,\s*stock:?\s*(\d+))?', message, re.I)
            if add_match or re.search(r'\badd\b.*\bproduct\b', message, re.I):
                name_match = re.search(r'name:?\s*([^,]+)', message, re.I)
                price_match = re.search(r'price:?\s*(\d+)', message, re.I)
                stock_match = re.search(r'stock:?\s*(\d+)', message, re.I)
                
                if name_match and price_match and stock_match:
                    # All fields provided
                    product_data = {
                        'name': name_match.group(1).strip(),
                        'sellingPrice': float(price_match.group(1)),
                        'stock': int(stock_match.group(1))
                    }
                    product = db.add_product(product_data)
                    response['reply'] = f"✅ Product **'{product['name']}'** added successfully!\n📊 Price: ${product['sellingPrice']}\n📦 Stock: {product['stock']}\n🔑 SKU: {product['sku']}"
                    return response
                else:
                    # Ask for missing fields
                    self.pending_actions[user_id] = {
                        'type': 'add_product',
                        'collected': {},
                        'required': ['name', 'sellingPrice', 'stock'],
                        'collected_fields': []
                    }
                    
                    missing = []
                    if not name_match:
                        missing.append("name")
                    if not price_match:
                        missing.append("price")
                    if not stock_match:
                        missing.append("stock")
                    
                    response['reply'] = f"Please provide the missing information for the product:\n\nRequired: {', '.join(missing)}\n\nExample: name: Product Name, price: 100, stock: 50"
                    response['needs_follow_up'] = True
                    return response
        
        # ============ CUSTOMERS ============
        if re.search(r'\b(customer|customers)\b', message, re.I):
            # Count customers
            if re.search(r'\b(how many|total|count|number of)\b.*\bcustomer', message, re.I):
                count = db.get_customers_count()
                response['reply'] = f"👥 You have **{count}** customers."
                return response
            
            # Show customers
            if re.search(r'\b(show|list|display|view)\b.*\bcustomer', message, re.I):
                customers = db.get_customers(limit=10)
                if not customers:
                    response['reply'] = "No customers found."
                    return response
                
                reply = "👥 **Customers:**\n\n"
                for c in customers:
                    reply += f"• {c.get('name', 'Unknown')} - {c.get('email', 'No email')}\n"
                response['reply'] = reply
                return response
            
            # Add customer
            if re.search(r'\badd\b.*\bcustomer\b', message, re.I):
                name_match = re.search(r'name:?\s*([^,]+)', message, re.I)
                email_match = re.search(r'email:?\s*([^,]+)', message, re.I)
                phone_match = re.search(r'phone:?\s*([^,]+)', message, re.I)
                
                if name_match and email_match and phone_match:
                    customer_data = {
                        'name': name_match.group(1).strip(),
                        'email': email_match.group(1).strip(),
                        'phone': phone_match.group(1).strip()
                    }
                    customer = db.add_customer(customer_data)
                    response['reply'] = f"✅ Customer **'{customer['name']}'** added successfully!\n📧 Email: {customer['email']}\n📱 Phone: {customer['phone']}"
                    return response
                else:
                    # Ask for missing fields
                    self.pending_actions[user_id] = {
                        'type': 'add_customer',
                        'collected': {},
                        'required': ['name', 'email', 'phone'],
                        'collected_fields': []
                    }
                    
                    missing = []
                    if not name_match:
                        missing.append("name")
                    if not email_match:
                        missing.append("email")
                    if not phone_match:
                        missing.append("phone")
                    
                    response['reply'] = f"Please provide the missing information for the customer:\n\nRequired: {', '.join(missing)}\n\nExample: name: John Doe, email: john@email.com, phone: 1234567890"
                    response['needs_follow_up'] = True
                    return response
        
        # ============ VENDORS ============
        if re.search(r'\b(vendor|vendors|supplier|suppliers)\b', message, re.I):
            # Count vendors
            if re.search(r'\b(how many|total|count|number of)\b.*\bvendor', message, re.I):
                count = db.get_vendors_count()
                response['reply'] = f"🏪 You have **{count}** vendors."
                return response
            
            # Show vendors
            if re.search(r'\b(show|list|display|view)\b.*\bvendor', message, re.I):
                vendors = db.get_vendors(limit=10)
                if not vendors:
                    response['reply'] = "No vendors found."
                    return response
                
                reply = "🏪 **Vendors:**\n\n"
                for v in vendors:
                    reply += f"• {v.get('name', 'Unknown')} - {v.get('email', 'No email')}\n"
                response['reply'] = reply
                return response
            
            # Add vendor
            if re.search(r'\badd\b.*\bvendor\b', message, re.I):
                name_match = re.search(r'name:?\s*([^,]+)', message, re.I)
                email_match = re.search(r'email:?\s*([^,]+)', message, re.I)
                phone_match = re.search(r'phone:?\s*([^,]+)', message, re.I)
                
                if name_match and email_match and phone_match:
                    vendor_data = {
                        'name': name_match.group(1).strip(),
                        'email': email_match.group(1).strip(),
                        'phone': phone_match.group(1).strip(),
                        'contactName': name_match.group(1).strip()
                    }
                    vendor, error = db.add_vendor(vendor_data)
                    if error:
                        response['reply'] = f"❌ {error}"
                    else:
                        response['reply'] = f"✅ Vendor **'{vendor['name']}'** added successfully!\n📧 Email: {vendor['email']}\n📱 Phone: {vendor['phone']}"
                    return response
                else:
                    # Ask for missing fields
                    self.pending_actions[user_id] = {
                        'type': 'add_vendor',
                        'collected': {},
                        'required': ['name', 'email', 'phone'],
                        'collected_fields': []
                    }
                    
                    missing = []
                    if not name_match:
                        missing.append("name")
                    if not email_match:
                        missing.append("email")
                    if not phone_match:
                        missing.append("phone")
                    
                    response['reply'] = f"Please provide the missing information for the vendor:\n\nRequired: {', '.join(missing)}\n\nExample: name: Tech Supplies, email: tech@supplies.com, phone: 1234567890"
                    response['needs_follow_up'] = True
                    return response
        
        # ============ REVENUE ============
        if re.search(r'\b(revenue|sales|earning|profit|income)\b', message, re.I):
            revenue = db.get_revenue()
            orders = db.get_orders_count()
            response['reply'] = f"💰 **Revenue:** ${revenue:,.2f}\n📊 **Total Orders:** {orders}"
            return response
        
        # ============ DEFAULT ============
        response['reply'] = "I'm not sure how to help with that. Try asking about:\n• Products\n• Customers\n• Vendors\n• Revenue\n• Help\n\nOr be more specific about what you'd like to do."
        return response
    
    def _handle_pending_action(self, user_id: str, message: str) -> Optional[Dict[str, Any]]:
        """Handle multi-step action completion"""
        action = self.pending_actions.get(user_id)
        if not action:
            return None
        
        # Parse the message for field: value pairs
        parts = message.split(',')
        for part in parts:
            part = part.strip()
            if ':' in part:
                key, value = part.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                action['collected'][key] = value
                if key not in action['collected_fields']:
                    action['collected_fields'].append(key)
        
        # Check if we have all required fields
        has_all = all(field in action['collected_fields'] for field in action['required'])
        
        if not has_all:
            # Ask for remaining fields
            missing = [f for f in action['required'] if f not in action['collected_fields']]
            response = {
                'reply': f"Still need: {', '.join(missing)}\n\nPlease provide them in the format: field: value",
                'needs_follow_up': True
            }
            return response
        
        # All fields collected - execute the action
        response = {'reply': '', 'needs_follow_up': False}
        
        if action['type'] == 'add_product':
            product_data = {
                'name': action['collected'].get('name', 'Product'),
                'sellingPrice': float(action['collected'].get('price', 0)),
                'stock': int(action['collected'].get('stock', 0))
            }
            product = db.add_product(product_data)
            response['reply'] = f"✅ Product **'{product['name']}'** added successfully!\n📊 Price: ${product['sellingPrice']}\n📦 Stock: {product['stock']}\n🔑 SKU: {product['sku']}"
            del self.pending_actions[user_id]
            return response
        
        elif action['type'] == 'add_customer':
            customer_data = {
                'name': action['collected'].get('name', 'Customer'),
                'email': action['collected'].get('email', ''),
                'phone': action['collected'].get('phone', '')
            }
            customer = db.add_customer(customer_data)
            response['reply'] = f"✅ Customer **'{customer['name']}'** added successfully!\n📧 Email: {customer['email']}\n📱 Phone: {customer['phone']}"
            del self.pending_actions[user_id]
            return response
        
        elif action['type'] == 'add_vendor':
            vendor_data = {
                'name': action['collected'].get('name', 'Vendor'),
                'email': action['collected'].get('email', ''),
                'phone': action['collected'].get('phone', ''),
                'contactName': action['collected'].get('name', 'Vendor')
            }
            vendor, error = db.add_vendor(vendor_data)
            if error:
                response['reply'] = f"❌ {error}"
            else:
                response['reply'] = f"✅ Vendor **'{vendor['name']}'** added successfully!\n📧 Email: {vendor['email']}\n📱 Phone: {vendor['phone']}"
            del self.pending_actions[user_id]
            return response
        
        return None

# Singleton instance
ai_agent = AIAgent()