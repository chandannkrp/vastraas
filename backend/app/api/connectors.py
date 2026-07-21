"""Connectors — each seller connects their own Shopify store."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import get_settings
from app.db import get_db
from app.models.tables import Seller, ShopifyConnection
from app.schemas.catalog import ConnectorStatus
from app.services.shopify import (
    ShopifyClient,
    ShopifyCreds,
    ShopifyError,
    creds_for_seller,
)

router = APIRouter(prefix="/connectors", tags=["connectors"])
settings = get_settings()


def _status_for(creds: ShopifyCreds) -> ConnectorStatus:
    if not creds.configured:
        return ConnectorStatus(
            connected=False,
            store_domain=creds.store_domain or None,
            detail="Not connected. Add your store domain and either an Admin API token, "
            "or a Client ID + Client Secret.",
        )
    try:
        shop = ShopifyClient(creds).ping()
        return ConnectorStatus(
            connected=True,
            store_domain=creds.store_domain,
            shop_name=shop.get("name"),
            detail="Connected to your store.",
        )
    except (ShopifyError, Exception) as exc:  # noqa: BLE001
        return ConnectorStatus(
            connected=False,
            store_domain=creds.store_domain,
            detail=f"Credentials set but connection failed: {exc}",
        )


@router.get("/shopify", response_model=ConnectorStatus)
def shopify_status(
    user: Seller = Depends(get_current_user), db: Session = Depends(get_db)
) -> ConnectorStatus:
    return _status_for(creds_for_seller(db, user.id))


@router.post("/shopify", response_model=ConnectorStatus)
def connect_shopify(
    payload: dict,
    user: Seller = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectorStatus:
    """Save (or update) this seller's own store credentials, after a live test."""
    domain = (payload.get("store_domain") or "").strip().replace("https://", "").replace("http://", "").strip("/")
    admin_token = (payload.get("admin_token") or "").strip()
    client_id = (payload.get("client_id") or "").strip()
    client_secret = (payload.get("client_secret") or "").strip()

    if not domain:
        raise HTTPException(status_code=400, detail="Store domain is required (e.g. your-store.myshopify.com).")
    if not (admin_token or (client_id and client_secret)):
        raise HTTPException(
            status_code=400,
            detail="Provide either an Admin API access token, or both a Client ID and Client Secret.",
        )

    creds = ShopifyCreds(
        store_domain=domain, admin_token=admin_token, client_id=client_id, client_secret=client_secret
    )
    # Verify before persisting so we never save creds that don't work.
    try:
        shop = ShopifyClient(creds).ping()
    except (ShopifyError, Exception) as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not connect: {exc}")

    conn = db.query(ShopifyConnection).filter(ShopifyConnection.seller_id == user.id).first()
    if conn is None:
        conn = ShopifyConnection(seller_id=user.id)
        db.add(conn)
    conn.store_domain = domain
    conn.admin_token = admin_token or None
    conn.client_id = client_id or None
    conn.client_secret = client_secret or None
    conn.shop_name = shop.get("name")
    db.commit()

    return ConnectorStatus(
        connected=True,
        store_domain=domain,
        shop_name=shop.get("name"),
        detail="Connected to your store.",
    )


@router.delete("/shopify")
def disconnect_shopify(
    user: Seller = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    conn = db.query(ShopifyConnection).filter(ShopifyConnection.seller_id == user.id).first()
    if conn:
        db.delete(conn)
        db.commit()
    return {"disconnected": True}


@router.get("/shopify/collections")
def shopify_collections(
    user: Seller = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    creds = creds_for_seller(db, user.id)
    if not creds.configured:
        return {"collections": []}
    from app.services.cache import cached

    def _fetch() -> dict:
        try:
            cols = ShopifyClient(creds).list_collections()
            return {"collections": [{"id": c["id"], "title": c["title"]} for c in cols]}
        except Exception:  # noqa: BLE001
            return {"collections": []}

    # Collections rarely change; cache 5 min per store to avoid the slow round-trip.
    return cached(f"shopify:collections:{creds.store_domain}", 300, _fetch)
