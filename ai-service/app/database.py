# ai-service/app/database.py
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
import re

load_dotenv()

class Database:
    def __init__(self):
        self.client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
        self.db = self.client.get_database("intellipos")
        self.chat_history = self.db.chat_history
    
    # ============ PRODUCT OPERATIONS ============
    def get_products_count(self):
        """Get total number of products"""
        return self.db.products.count_documents({"isDeleted": False})
    
    def get_products(self, limit=10):
        """Get products with details"""
        return list(self.db.products.find(
            {"isDeleted": False},
            {"_id": 1, "name": 1, "sku": 1, "sellingPrice": 1, "stock": 1, "category": 1}
        ).limit(limit))
    
    def get_low_stock_products(self):
        """Get products with low stock"""
        return list(self.db.products.find({
            "isDeleted": False,
            "$expr": {"$lte": ["$stock", "$minStock"]}
        }))
    
    def add_product(self, data):
        """Add a new product"""
        # Auto-generate SKU if not provided
        if not data.get('sku'):
            name = data.get('name', 'PROD')
            data['sku'] = f"PROD-{datetime.now().strftime('%Y%m%d')}-{self.db.products.count_documents({}) + 1:04d}"
        
        # Set default values
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
        
        result = self.db.products.insert_one(data)
        return self.db.products.find_one({"_id": result.inserted_id})
    
    def update_product_stock(self, product_id, quantity):
        """Update product stock"""
        result = self.db.products.update_one(
            {"_id": product_id},
            {"$inc": {"stock": quantity}, "$set": {"updatedAt": datetime.now()}}
        )
        return result.modified_count > 0
    
    # ============ CUSTOMER OPERATIONS ============
    def get_customers_count(self):
        """Get total number of customers"""
        return self.db.customers.count_documents({})
    
    def get_customers(self, limit=10):
        """Get customers with details"""
        return list(self.db.customers.find({}).limit(limit))
    
    def add_customer(self, data):
        """Add a new customer"""
        data.setdefault('status', 'active')
        data.setdefault('totalPurchases', 0)
        data['createdAt'] = datetime.now()
        data['updatedAt'] = datetime.now()
        
        result = self.db.customers.insert_one(data)
        return self.db.customers.find_one({"_id": result.inserted_id})
    
    # ============ VENDOR OPERATIONS ============
    def get_vendors_count(self):
        """Get total number of vendors"""
        return self.db.vendors.count_documents({})
    
    def get_vendors(self, limit=10):
        """Get vendors with details"""
        return list(self.db.vendors.find({}).limit(limit))
    
    def add_vendor(self, data):
        """Add a new vendor"""
        data.setdefault('status', 'active')
        data['createdAt'] = datetime.now()
        data['updatedAt'] = datetime.now()
        
        # Check for duplicate email
        existing = self.db.vendors.find_one({"email": data.get('email')})
        if existing:
            return None, "Vendor with this email already exists"
        
        result = self.db.vendors.insert_one(data)
        return self.db.vendors.find_one({"_id": result.inserted_id}), None
    
    # ============ EMPLOYEE OPERATIONS ============
    def get_employees_count(self):
        """Get total number of employees"""
        return self.db.employees.count_documents({})
    
    # ============ ORDER OPERATIONS ============
    def get_orders_count(self):
        """Get total number of orders"""
        return self.db.orders.count_documents({})
    
    def get_revenue(self):
        """Get total revenue"""
        pipeline = [
            {"$match": {"paymentStatus": "paid", "isDeleted": False}},
            {"$group": {"_id": None, "total": {"$sum": "$grandTotal"}}}
        ]
        result = list(self.db.orders.aggregate(pipeline))
        return result[0]['total'] if result else 0
    
    # ============ CHAT HISTORY ============
    def save_chat_message(self, user_id, user_email, role, message):
        """Save a chat message"""
        self.chat_history.update_one(
            {"userId": user_id},
            {
                "$push": {
                    "messages": {
                        "role": role,
                        "text": message,
                        "timestamp": datetime.now()
                    }
                },
                "$set": {
                    "userEmail": user_email,
                    "updatedAt": datetime.now()
                }
            },
            upsert=True
        )
    
    def get_chat_history(self, user_id, limit=50):
        """Get chat history for a user"""
        history = self.chat_history.find_one({"userId": user_id})
        if history and 'messages' in history:
            return history['messages'][-limit:]
        return []

# Singleton instance
db = Database()