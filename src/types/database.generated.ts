export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addon_products: {
        Row: {
          category: Database["public"]["Enums"]["addon_category"]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["addon_category"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["addon_category"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      aircraft: {
        Row: {
          airline_id: string
          created_at: string
          id: string
          is_active: boolean
          model_name: string
          registration_code: string
          updated_at: string
        }
        Insert: {
          airline_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_name: string
          registration_code: string
          updated_at?: string
        }
        Update: {
          airline_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          model_name?: string
          registration_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
        ]
      }
      airlines: {
        Row: {
          created_at: string
          iata_code: string
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          iata_code: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          iata_code?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      airports: {
        Row: {
          city: string
          country_code: string
          created_at: string
          iata_code: string
          id: string
          is_active: boolean
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          city: string
          country_code: string
          created_at?: string
          iata_code: string
          id?: string
          is_active?: boolean
          name: string
          timezone: string
          updated_at?: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          iata_code?: string
          id?: string
          is_active?: boolean
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          booking_id: string
          category_snapshot: Database["public"]["Enums"]["addon_category"]
          created_at: string
          currency: string
          flight_id: string
          id: string
          offer_id: string
          passenger_segment_id: string
          product_name_snapshot: string
          quantity: number
          total_amount: number | null
          unit_amount: number
          updated_at: string
          weight_kg_snapshot: number | null
        }
        Insert: {
          booking_id: string
          category_snapshot: Database["public"]["Enums"]["addon_category"]
          created_at?: string
          currency?: string
          flight_id: string
          id?: string
          offer_id: string
          passenger_segment_id: string
          product_name_snapshot: string
          quantity: number
          total_amount?: number | null
          unit_amount: number
          updated_at?: string
          weight_kg_snapshot?: number | null
        }
        Update: {
          booking_id?: string
          category_snapshot?: Database["public"]["Enums"]["addon_category"]
          created_at?: string
          currency?: string
          flight_id?: string
          id?: string
          offer_id?: string
          passenger_segment_id?: string
          product_name_snapshot?: string
          quantity?: number
          total_amount?: number | null
          unit_amount?: number
          updated_at?: string
          weight_kg_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_offer_id_flight_id_fkey"
            columns: ["offer_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "flight_addon_offers"
            referencedColumns: ["id", "flight_id"]
          },
          {
            foreignKeyName: "booking_addons_passenger_segment_id_booking_id_flight_id_fkey"
            columns: ["passenger_segment_id", "booking_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "booking_passenger_segments"
            referencedColumns: ["id", "booking_id", "flight_id"]
          },
        ]
      }
      booking_events: {
        Row: {
          actor_user_id: string | null
          booking_id: string
          created_at: string
          customer_visible: boolean
          event_type: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          metadata: Json
          safe_message: string
          to_status: Database["public"]["Enums"]["booking_status"] | null
        }
        Insert: {
          actor_user_id?: string | null
          booking_id: string
          created_at?: string
          customer_visible?: boolean
          event_type: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          safe_message: string
          to_status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Update: {
          actor_user_id?: string | null
          booking_id?: string
          created_at?: string
          customer_visible?: boolean
          event_type?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          metadata?: Json
          safe_message?: string
          to_status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_passenger_segments: {
        Row: {
          accompanying_passenger_id: string | null
          allowance_snapshot: Json
          base_amount: number
          booking_id: string
          cancellation_rules_snapshot: Json
          created_at: string
          currency: string
          fee_amount: number
          flight_id: string
          id: string
          passenger_id: string
          passenger_type: Database["public"]["Enums"]["passenger_type"]
          requires_seat: boolean
          segment_id: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          accompanying_passenger_id?: string | null
          allowance_snapshot: Json
          base_amount: number
          booking_id: string
          cancellation_rules_snapshot: Json
          created_at?: string
          currency?: string
          fee_amount: number
          flight_id: string
          id?: string
          passenger_id: string
          passenger_type: Database["public"]["Enums"]["passenger_type"]
          requires_seat: boolean
          segment_id: string
          tax_amount: number
          updated_at?: string
        }
        Update: {
          accompanying_passenger_id?: string | null
          allowance_snapshot?: Json
          base_amount?: number
          booking_id?: string
          cancellation_rules_snapshot?: Json
          created_at?: string
          currency?: string
          fee_amount?: number
          flight_id?: string
          id?: string
          passenger_id?: string
          passenger_type?: Database["public"]["Enums"]["passenger_type"]
          requires_seat?: boolean
          segment_id?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_passenger_segments_accompanying_passenger_id_booki_fkey"
            columns: ["accompanying_passenger_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "booking_passengers"
            referencedColumns: ["id", "booking_id"]
          },
          {
            foreignKeyName: "booking_passenger_segments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_passenger_segments_passenger_id_booking_id_fkey"
            columns: ["passenger_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "booking_passengers"
            referencedColumns: ["id", "booking_id"]
          },
          {
            foreignKeyName: "booking_passenger_segments_segment_id_booking_id_flight_id_fkey"
            columns: ["segment_id", "booking_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "booking_segments"
            referencedColumns: ["id", "booking_id", "flight_id"]
          },
        ]
      }
      booking_passengers: {
        Row: {
          booking_id: string
          created_at: string
          date_of_birth: string
          document_expiry_date: string | null
          document_issuer_country: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          family_name: string
          given_names: string
          id: string
          nationality_code: string | null
          ordinal: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          date_of_birth: string
          document_expiry_date?: string | null
          document_issuer_country?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          family_name: string
          given_names: string
          id?: string
          nationality_code?: string | null
          ordinal: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          date_of_birth?: string
          document_expiry_date?: string | null
          document_issuer_country?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          family_name?: string
          given_names?: string
          id?: string
          nationality_code?: string | null
          ordinal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_passengers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_segments: {
        Row: {
          booking_id: string
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          created_at: string
          fare_code_snapshot: string
          fare_id: string
          flight_id: string
          flight_snapshot: Json
          id: string
          journey_number: number
          leg_number: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          created_at?: string
          fare_code_snapshot: string
          fare_id: string
          flight_id: string
          flight_snapshot: Json
          id?: string
          journey_number: number
          leg_number: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          cabin_class?: Database["public"]["Enums"]["cabin_class"]
          created_at?: string
          fare_code_snapshot?: string
          fare_id?: string
          flight_id?: string
          flight_snapshot?: Json
          id?: string
          journey_number?: number
          leg_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_segments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_segments_fare_id_flight_id_fkey"
            columns: ["fare_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "flight_fares"
            referencedColumns: ["id", "flight_id"]
          },
          {
            foreignKeyName: "booking_segments_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          addon_amount: number
          base_amount: number
          booking_code: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          create_request_hash: string
          create_request_id: string
          created_at: string
          currency: string
          expires_at: string
          fee_amount: number
          id: string
          refund_policy_snapshot: Json
          seat_amount: number
          status: Database["public"]["Enums"]["booking_status"]
          tax_amount: number
          total_amount: number
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          addon_amount: number
          base_amount: number
          booking_code: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          create_request_hash: string
          create_request_id: string
          created_at?: string
          currency?: string
          expires_at: string
          fee_amount: number
          id?: string
          refund_policy_snapshot: Json
          seat_amount: number
          status?: Database["public"]["Enums"]["booking_status"]
          tax_amount: number
          total_amount: number
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          addon_amount?: number
          base_amount?: number
          booking_code?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          create_request_hash?: string
          create_request_id?: string
          created_at?: string
          currency?: string
          expires_at?: string
          fee_amount?: number
          id?: string
          refund_policy_snapshot?: Json
          seat_amount?: number
          status?: Database["public"]["Enums"]["booking_status"]
          tax_amount?: number
          total_amount?: number
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      destinations: {
        Row: {
          airport_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          is_featured: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          airport_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_featured?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          airport_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_featured?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_airport_id_fkey"
            columns: ["airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_addon_offers: {
        Row: {
          created_at: string
          currency: string
          flight_id: string
          id: string
          is_active: boolean
          max_quantity_per_passenger: number
          product_id: string
          unit_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          flight_id: string
          id?: string
          is_active?: boolean
          max_quantity_per_passenger: number
          product_id: string
          unit_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          flight_id?: string
          id?: string
          is_active?: boolean
          max_quantity_per_passenger?: number
          product_id?: string
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_addon_offers_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_addon_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "addon_products"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_fares: {
        Row: {
          adult_base_amount: number
          adult_fee_amount: number
          adult_tax_amount: number
          baggage_allowance: Json
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          cancellation_allowed: boolean
          cancellation_cutoff_minutes: number
          cancellation_fee_amount: number
          child_base_amount: number
          child_fee_amount: number
          child_tax_amount: number
          created_at: string
          currency: string
          fare_code: string
          flight_id: string
          id: string
          infant_base_amount: number
          infant_fee_amount: number
          infant_tax_amount: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          adult_base_amount: number
          adult_fee_amount?: number
          adult_tax_amount?: number
          baggage_allowance?: Json
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          cancellation_allowed?: boolean
          cancellation_cutoff_minutes?: number
          cancellation_fee_amount?: number
          child_base_amount: number
          child_fee_amount?: number
          child_tax_amount?: number
          created_at?: string
          currency?: string
          fare_code: string
          flight_id: string
          id?: string
          infant_base_amount: number
          infant_fee_amount?: number
          infant_tax_amount?: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          adult_base_amount?: number
          adult_fee_amount?: number
          adult_tax_amount?: number
          baggage_allowance?: Json
          cabin_class?: Database["public"]["Enums"]["cabin_class"]
          cancellation_allowed?: boolean
          cancellation_cutoff_minutes?: number
          cancellation_fee_amount?: number
          child_base_amount?: number
          child_fee_amount?: number
          child_tax_amount?: number
          created_at?: string
          currency?: string
          fare_code?: string
          flight_id?: string
          id?: string
          infant_base_amount?: number
          infant_fee_amount?: number
          infant_tax_amount?: number
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_fares_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_instances: {
        Row: {
          aircraft_id: string
          airline_id: string
          arrival_airport_id: string
          arrival_at: string
          created_at: string
          departure_airport_id: string
          departure_at: string
          flight_number: string
          id: string
          published_at: string | null
          sales_close_at: string
          status: Database["public"]["Enums"]["flight_status"]
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          airline_id: string
          arrival_airport_id: string
          arrival_at: string
          created_at?: string
          departure_airport_id: string
          departure_at: string
          flight_number: string
          id?: string
          published_at?: string | null
          sales_close_at: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          airline_id?: string
          arrival_airport_id?: string
          arrival_at?: string
          created_at?: string
          departure_airport_id?: string
          departure_at?: string
          flight_number?: string
          id?: string
          published_at?: string | null
          sales_close_at?: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_instances_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_instances_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_instances_arrival_airport_id_fkey"
            columns: ["arrival_airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_instances_departure_airport_id_fkey"
            columns: ["departure_airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_seats: {
        Row: {
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          column_number: number
          created_at: string
          currency: string
          flight_id: string
          id: string
          is_blocked: boolean
          is_exit_row: boolean
          position: Database["public"]["Enums"]["seat_position"]
          row_number: number
          seat_code: string
          seat_id: string
          selection_fee_amount: number
          updated_at: string
        }
        Insert: {
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          column_number: number
          created_at?: string
          currency?: string
          flight_id: string
          id?: string
          is_blocked?: boolean
          is_exit_row: boolean
          position: Database["public"]["Enums"]["seat_position"]
          row_number: number
          seat_code: string
          seat_id: string
          selection_fee_amount?: number
          updated_at?: string
        }
        Update: {
          cabin_class?: Database["public"]["Enums"]["cabin_class"]
          column_number?: number
          created_at?: string
          currency?: string
          flight_id?: string
          id?: string
          is_blocked?: boolean
          is_exit_row?: boolean
          position?: Database["public"]["Enums"]["seat_position"]
          row_number?: number
          seat_code?: string
          seat_id?: string
          selection_fee_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_seats_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_seats_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          booking_version: number
          created_at: string
          currency: string
          failure_code: string | null
          id: string
          idempotency_key: string
          paid_at: string | null
          provider: string
          provider_reference: string | null
          request_hash: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          booking_version: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          id?: string
          idempotency_key: string
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          request_hash: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          booking_version?: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          request_hash?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          contact_phone: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          contact_phone?: string | null
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          contact_phone?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          booking_id: string
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          payment_id: string
          provider_reference: string | null
          reason: string
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          payment_id: string
          provider_reference?: string | null
          reason: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          payment_id?: string
          provider_reference?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_booking_id_fkey"
            columns: ["payment_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "booking_id"]
          },
        ]
      }
      seat_reservations: {
        Row: {
          booking_id: string
          confirmed_at: string | null
          created_at: string
          currency: string
          expires_at: string | null
          flight_id: string
          flight_seat_id: string
          id: string
          passenger_segment_id: string
          released_at: string | null
          selection_amount: number
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          flight_id: string
          flight_seat_id: string
          id?: string
          passenger_segment_id: string
          released_at?: string | null
          selection_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          flight_id?: string
          flight_seat_id?: string
          id?: string
          passenger_segment_id?: string
          released_at?: string | null
          selection_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_reservations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_reservations_flight_seat_id_flight_id_fkey"
            columns: ["flight_seat_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "flight_seats"
            referencedColumns: ["id", "flight_id"]
          },
          {
            foreignKeyName: "seat_reservations_passenger_segment_id_booking_id_flight_i_fkey"
            columns: ["passenger_segment_id", "booking_id", "flight_id"]
            isOneToOne: false
            referencedRelation: "booking_passenger_segments"
            referencedColumns: ["id", "booking_id", "flight_id"]
          },
        ]
      }
      seats: {
        Row: {
          aircraft_id: string
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          column_number: number
          created_at: string
          id: string
          is_active: boolean
          is_exit_row: boolean
          position: Database["public"]["Enums"]["seat_position"]
          row_number: number
          seat_code: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          column_number: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_exit_row?: boolean
          position: Database["public"]["Enums"]["seat_position"]
          row_number: number
          seat_code: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          cabin_class?: Database["public"]["Enums"]["cabin_class"]
          column_number?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_exit_row?: boolean
          position?: Database["public"]["Enums"]["seat_position"]
          row_number?: number
          seat_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_seat_map: {
        Args: { p_flight_id: string }
        Returns: {
          availability: string
          cabin_class: Database["public"]["Enums"]["cabin_class"]
          column_number: number
          currency: string
          flight_seat_id: string
          is_exit_row: boolean
          position: Database["public"]["Enums"]["seat_position"]
          row_number: number
          seat_code: string
          selection_fee_amount: number
        }[]
      }
    }
    Enums: {
      addon_category: "baggage" | "meal" | "insurance_demo"
      booking_status: "pending_payment" | "confirmed" | "cancelled" | "expired"
      cabin_class: "economy" | "premium_economy" | "business" | "first"
      document_type: "national_id" | "passport"
      flight_status:
        | "draft"
        | "scheduled"
        | "delayed"
        | "departed"
        | "arrived"
        | "cancelled"
      passenger_type: "adult" | "child" | "infant"
      payment_status: "pending" | "succeeded" | "failed" | "cancelled"
      refund_status: "pending" | "succeeded" | "failed"
      reservation_status: "held" | "confirmed" | "released" | "expired"
      seat_position: "window" | "middle" | "aisle"
      trip_type: "one_way" | "round_trip" | "multi_city"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      addon_category: ["baggage", "meal", "insurance_demo"],
      booking_status: ["pending_payment", "confirmed", "cancelled", "expired"],
      cabin_class: ["economy", "premium_economy", "business", "first"],
      document_type: ["national_id", "passport"],
      flight_status: [
        "draft",
        "scheduled",
        "delayed",
        "departed",
        "arrived",
        "cancelled",
      ],
      passenger_type: ["adult", "child", "infant"],
      payment_status: ["pending", "succeeded", "failed", "cancelled"],
      refund_status: ["pending", "succeeded", "failed"],
      reservation_status: ["held", "confirmed", "released", "expired"],
      seat_position: ["window", "middle", "aisle"],
      trip_type: ["one_way", "round_trip", "multi_city"],
    },
  },
} as const
