import asyncio
from app.auth.jwt import hash_password, verify_password

def test():
    try:
        print("Testing hashing...")
        hashed = hash_password("test_password123")
        print("Hashed:", hashed)
        
        print("Testing verify...")
        is_valid = verify_password("test_password123", hashed)
        print("Is Valid:", is_valid)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()
