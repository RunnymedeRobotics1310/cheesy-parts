-- Migration: initial_schema
-- Created: Cheesy Parts PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  permission VARCHAR(20) NOT NULL DEFAULT 'readonly' CHECK (permission IN ('readonly', 'editor', 'admin')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for login lookups
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- PROJECTS TABLE
-- ============================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  part_number_prefix VARCHAR(50) NOT NULL,
  hide_dashboards BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PARTS TABLE
-- ============================================

CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('part', 'assembly')),
  name VARCHAR(255) NOT NULL,
  parent_part_id UUID REFERENCES parts(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'designing' CHECK (status IN (
    'designing', 'material', 'ordered', 'drawing', 'ready',
    'cnc', 'laser', 'lathe', 'mill', 'printer', 'router',
    'manufacturing', 'outsourced', 'welding', 'scotchbrite',
    'anodize', 'powder', 'coating', 'assembly', 'done'
  )),
  notes TEXT DEFAULT '',
  source_material VARCHAR(255) DEFAULT '',
  have_material BOOLEAN NOT NULL DEFAULT false,
  quantity VARCHAR(50) DEFAULT '',
  cut_length VARCHAR(50) DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority IN (0, 1, 2)),
  drawing_created BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_parts_project_id ON parts(project_id);
CREATE INDEX idx_parts_parent_part_id ON parts(parent_part_id);
CREATE INDEX idx_parts_status ON parts(status);
CREATE INDEX idx_parts_type ON parts(type);

-- Composite index for part number generation
CREATE INDEX idx_parts_project_type_number ON parts(project_id, type, part_number);

-- ============================================
-- ORDERS TABLE
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ordered', 'received')),
  ordered_at DATE,
  paid_for_by VARCHAR(255),
  tax_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  reimbursed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_orders_project_id ON orders(project_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_vendor_name ON orders(vendor_name);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  part_number VARCHAR(255) DEFAULT '',
  description VARCHAR(255) DEFAULT '',
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_order_items_project_id ON order_items(project_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ADMIN USER
-- ============================================

-- Create a default admin user (password: chezypofs)
-- PBKDF2 hash with salt: 'defaultsalt1234' (you should change this after setup)
-- This user should be deleted after creating a real admin account

INSERT INTO users (email, password_hash, salt, first_name, last_name, permission, enabled)
VALUES (
  'deleteme@team254.com',
  -- This is a placeholder hash - the actual hash will depend on the PBKDF2 implementation
  -- For initial setup, you can use the registration endpoint or update this manually
  'placeholder_hash_change_me',
  'defaultsalt1234',
  'Delete',
  'Me',
  'admin',
  true
);
