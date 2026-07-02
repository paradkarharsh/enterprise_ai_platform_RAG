"""
Role-Based Access Control (RBAC) for endpoint authorization.
"""
from functools import wraps
from typing import List
from fastapi import HTTPException, status
from app.db.models import User, UserRole


def require_role(allowed_roles: List[UserRole]):
    """Decorator/dependency factory to restrict access by role."""
    def role_checker(current_user: User):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return role_checker


def require_admin(current_user: User) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_editor(current_user: User) -> User:
    """Require editor or admin role."""
    if current_user.role not in [UserRole.ADMIN, UserRole.EDITOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor access required",
        )
    return current_user


class PermissionChecker:
    """Fine-grained permission checking."""

    PERMISSIONS = {
        UserRole.ADMIN: {
            "documents": ["create", "read", "update", "delete", "reindex"],
            "users": ["create", "read", "update", "delete"],
            "analytics": ["read", "export"],
            "settings": ["read", "update"],
            "graph": ["read", "write", "delete"],
        },
        UserRole.EDITOR: {
            "documents": ["create", "read", "update"],
            "users": ["read"],
            "analytics": ["read"],
            "settings": ["read"],
            "graph": ["read", "write"],
        },
        UserRole.VIEWER: {
            "documents": ["read"],
            "users": [],
            "analytics": ["read"],
            "settings": ["read"],
            "graph": ["read"],
        },
        UserRole.API_USER: {
            "documents": ["read"],
            "users": [],
            "analytics": [],
            "settings": [],
            "graph": ["read"],
        },
    }

    @staticmethod
    def has_permission(user: User, resource: str, action: str) -> bool:
        """Check if a user has a specific permission."""
        role_perms = PermissionChecker.PERMISSIONS.get(user.role, {})
        resource_perms = role_perms.get(resource, [])
        return action in resource_perms

    @staticmethod
    def check_permission(user: User, resource: str, action: str):
        """Check permission and raise if denied."""
        if not PermissionChecker.has_permission(user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {action} on {resource}",
            )
