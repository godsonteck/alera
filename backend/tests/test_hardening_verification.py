import json
import unittest
from unittest.mock import MagicMock, patch

from app.models.user import UserRole
from app.utils.access import is_workforce_role
from app.utils.auth import validate_password_strength
from app.utils.redis import redis_get_json, redis_set_json


class TestHardeningOptimizations(unittest.TestCase):
    def test_password_strength_validator(self):
        with self.assertRaises(ValueError):
            validate_password_strength("short1")

        with self.assertRaises(ValueError):
            validate_password_strength("NoDigitsHere")

        with self.assertRaises(ValueError):
            validate_password_strength("12345678")

        self.assertEqual(validate_password_strength("ValidPass123"), "ValidPass123")

    @patch("app.utils.redis.get_redis_client")
    def test_redis_json_helpers(self, mock_get_redis):
        mock_client = MagicMock()
        mock_get_redis.return_value = mock_client

        test_data = {"status": "ok", "maintenance": False}

        redis_set_json("test_key", test_data)
        mock_client.set.assert_called_once()
        args, _kwargs = mock_client.set.call_args
        self.assertEqual(args[0], "test_key")
        self.assertIn('"status": "ok"', args[1])

        mock_client.get.return_value = json.dumps(test_data)
        result = redis_get_json("test_key")
        self.assertEqual(result, test_data)

    def test_workforce_role_optimization(self):
        self.assertTrue(is_workforce_role(UserRole.PROVIDER))
        self.assertTrue(is_workforce_role("provider"))
        self.assertFalse(is_workforce_role(UserRole.PATIENT))
        self.assertFalse(is_workforce_role("patient"))
        self.assertFalse(is_workforce_role(None))


if __name__ == "__main__":
    unittest.main()
