"""Object storage abstraction: local filesystem in dev, S3-compatible (Cloudflare R2) in prod."""

from pathlib import Path

from app.config import get_settings

settings = get_settings()


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError(f"Invalid storage key: {key}")
        return path

    def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def load(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def list_objects(self, prefix: str = "", limit: int = 200) -> list[dict]:
        base = self.root.resolve()
        out: list[dict] = []
        for p in base.rglob("*"):
            if not p.is_file():
                continue
            key = p.relative_to(base).as_posix()
            if prefix and not key.startswith(prefix):
                continue
            st = p.stat()
            out.append({"key": key, "size": st.st_size, "last_modified": st.st_mtime})
            if len(out) >= limit:
                break
        out.sort(key=lambda o: o["last_modified"], reverse=True)
        return out




class S3Storage:
    """AWS S3 (or any S3-compatible store via a custom endpoint, e.g. R2)."""

    def __init__(self):
        import boto3

        self.bucket = settings.aws_bucket_name
        if not self.bucket:
            raise RuntimeError("AWS_BUCKET_NAME not configured")
        self.client = boto3.client(
            "s3",
            region_name=settings.aws_region or None,
            endpoint_url=settings.s3_endpoint_url or None,  # None => real AWS
            aws_access_key_id=settings.aws_access_key_id or None,
            aws_secret_access_key=settings.aws_secret_access_key or None,
        )

    def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return key

    def load(self, key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self.client.exceptions.NoSuchKey:
            raise FileNotFoundError(key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.client.exceptions.ClientError:
            return False

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def presigned_url(self, key: str, expires: int = 3600) -> str:
        """Time-limited public GET URL — used so Shopify can fetch the image."""
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=expires
        )

    def list_objects(self, prefix: str = "", limit: int = 200) -> list[dict]:
        resp = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix, MaxKeys=limit)
        out = [
            {"key": o["Key"], "size": o["Size"], "last_modified": o["LastModified"].timestamp()}
            for o in resp.get("Contents", [])
        ]
        out.sort(key=lambda o: o["last_modified"], reverse=True)
        return out


def get_storage():
    if settings.storage_backend == "s3":
        return S3Storage()
    return LocalStorage(settings.storage_local_dir)
